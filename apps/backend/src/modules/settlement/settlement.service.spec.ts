/**
 * SettlementService 단위 테스트 — 005-settlement [env:unit]
 *
 * 시나리오:
 *   - 정산 생성 Happy: completed 주문항목 집계 → totalSales/commission/payoutAmount Decimal 정확
 *   - 금전 계산: commission = totalSales × 0.1 (HALF_UP 2자리), payoutAmount = totalSales − commission
 *   - 빈 집계: items 없음 → 0/0/0, createItems 미호출
 *   - 조회 권한: 판매자 본인 / 관리자 전체
 */

import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, SettlementStatus } from '@prisma/client';
import { SettlementService } from './settlement.service';
import { SettlementRepository } from './settlement.repository';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { SellerService } from '../seller/seller.service';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSettlementRepository = {
  createSettlement: jest.fn(),
  createItems: jest.fn(),
  findById: jest.fn(),
  listBySeller: jest.fn(),
  listAll: jest.fn(),
};

const mockOrderService = {
  getCompletedItemsForSettlement: jest.fn(),
};

const mockSellerService = {
  getApprovedSeller: jest.fn(),
};

const mockPrismaService = {
  runInTransaction: jest.fn().mockImplementation((fn: () => unknown) => fn()),
  get tx() {
    return this;
  },
};

const PERIOD_START = new Date('2026-06-01');
const PERIOD_END = new Date('2026-06-30');

describe('SettlementService', () => {
  let service: SettlementService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: SettlementRepository, useValue: mockSettlementRepository },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OrderService, useValue: mockOrderService },
        { provide: SellerService, useValue: mockSellerService },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
  });

  // ── 정산 생성 ───────────────────────────────────────────────────────────

  describe('createSettlement', () => {
    it('when_completed_items_then_decimal_money_calculated_correctly', async () => {
      /**
       * 금전 계산 정확성:
       *   item1 saleAmount=10000, item2 saleAmount=23455 → totalSales=33455
       *   commission = 33455 × 0.1 = 3345.5
       *   payoutAmount = 33455 − 3345.5 = 30109.5
       *   per-item commission: 1000, 2345.5
       */
      mockOrderService.getCompletedItemsForSettlement.mockResolvedValue([
        { orderId: 'o1', orderItemId: 'oi1', saleAmount: new Prisma.Decimal('10000') },
        { orderId: 'o2', orderItemId: 'oi2', saleAmount: new Prisma.Decimal('23455') },
      ]);
      mockSettlementRepository.createSettlement.mockResolvedValue({ id: 'st-1' });
      mockSettlementRepository.createItems.mockResolvedValue(undefined);
      mockSettlementRepository.findById.mockResolvedValue({ id: 'st-1', items: [] });

      await service.createSettlement('seller-1', PERIOD_START, PERIOD_END);

      const arg = mockSettlementRepository.createSettlement.mock.calls[0][0];
      expect(arg.sellerId).toBe('seller-1');
      expect(arg.totalSales.toString()).toBe('33455');
      expect(arg.commission.toString()).toBe('3345.5');
      expect(arg.payoutAmount.toString()).toBe('30109.5');
      expect(arg.status).toBe(SettlementStatus.pending);

      const itemsArg = mockSettlementRepository.createItems.mock.calls[0][0];
      expect(itemsArg).toHaveLength(2);
      expect(itemsArg[0].saleAmount.toString()).toBe('10000');
      expect(itemsArg[0].commissionAmount.toString()).toBe('1000');
      expect(itemsArg[1].commissionAmount.toString()).toBe('2345.5');
    });

    it('when_commission_has_more_than_2_decimals_then_rounded_half_up', async () => {
      /**
       * 반올림: totalSales=100.05 → commission = 10.005 → HALF_UP 2자리 = 10.01
       *   payoutAmount = 100.05 − 10.01 = 90.04
       */
      mockOrderService.getCompletedItemsForSettlement.mockResolvedValue([
        { orderId: 'o1', orderItemId: 'oi1', saleAmount: new Prisma.Decimal('100.05') },
      ]);
      mockSettlementRepository.createSettlement.mockResolvedValue({ id: 'st-2' });
      mockSettlementRepository.findById.mockResolvedValue({ id: 'st-2', items: [] });

      await service.createSettlement('seller-1', PERIOD_START, PERIOD_END);

      const arg = mockSettlementRepository.createSettlement.mock.calls[0][0];
      expect(arg.totalSales.toString()).toBe('100.05');
      expect(arg.commission.toString()).toBe('10.01');
      expect(arg.payoutAmount.toString()).toBe('90.04');
    });

    it('when_no_completed_items_then_zero_amounts_and_no_items_created', async () => {
      mockOrderService.getCompletedItemsForSettlement.mockResolvedValue([]);
      mockSettlementRepository.createSettlement.mockResolvedValue({ id: 'st-3' });
      mockSettlementRepository.findById.mockResolvedValue({ id: 'st-3', items: [] });

      await service.createSettlement('seller-1', PERIOD_START, PERIOD_END);

      const arg = mockSettlementRepository.createSettlement.mock.calls[0][0];
      expect(arg.totalSales.toString()).toBe('0');
      expect(arg.commission.toString()).toBe('0');
      expect(arg.payoutAmount.toString()).toBe('0');
      expect(mockSettlementRepository.createItems).not.toHaveBeenCalled();
    });
  });

  // ── 정산 조회 ───────────────────────────────────────────────────────────

  describe('listMySettlements', () => {
    it('when_approved_seller_then_returns_own_settlements', async () => {
      mockSellerService.getApprovedSeller.mockResolvedValue({
        id: 'seller-1',
        userId: 'seller-user-1',
      });
      const list = [{ id: 'st-1', sellerId: 'seller-1' }];
      mockSettlementRepository.listBySeller.mockResolvedValue(list);

      const result = await service.listMySettlements('seller-user-1');

      expect(mockSettlementRepository.listBySeller).toHaveBeenCalledWith('seller-1');
      expect(result).toEqual(list);
    });

    it('when_non_approved_seller_then_ForbiddenException', async () => {
      mockSellerService.getApprovedSeller.mockRejectedValue(
        new ForbiddenException('Seller is not approved'),
      );

      await expect(service.listMySettlements('user-x')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('listAll', () => {
    it('when_admin_lists_all_then_returns_all_settlements', async () => {
      const list = [{ id: 'st-1' }, { id: 'st-2' }];
      mockSettlementRepository.listAll.mockResolvedValue(list);

      const result = await service.listAll();

      expect(mockSettlementRepository.listAll).toHaveBeenCalled();
      expect(result).toEqual(list);
    });
  });
});
