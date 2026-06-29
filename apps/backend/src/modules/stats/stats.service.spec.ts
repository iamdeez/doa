/**
 * StatsService 단위 테스트 — 007-stats [env:unit]
 *
 * 시나리오:
 *   - overview: 각 도메인 Service 집계 조합, totalSales Decimal 정확성
 *   - seller stats: APPROVED 판매자 본인 격리(getApprovedSeller 경유), 미승인 시 Forbidden
 */

import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { StatsService } from './stats.service';
import { OrderService } from '../order/order.service';
import { UserService } from '../user/user.service';
import { SellerService } from '../seller/seller.service';

const mockOrderService = {
  countAllOrders: jest.fn(),
  countCompletedOrders: jest.fn(),
  sumCompletedSales: jest.fn(),
  getSellerSalesSummary: jest.fn(),
};

const mockUserService = {
  countAllUsers: jest.fn(),
};

const mockSellerService = {
  countAllSellers: jest.fn(),
  getApprovedSeller: jest.fn(),
};

describe('StatsService', () => {
  let service: StatsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: OrderService, useValue: mockOrderService },
        { provide: UserService, useValue: mockUserService },
        { provide: SellerService, useValue: mockSellerService },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  // ── overview ────────────────────────────────────────────────────────

  describe('getOverview', () => {
    it('when_called_then_combines_domain_aggregates_with_decimal_sales', async () => {
      mockOrderService.countAllOrders.mockResolvedValue(120);
      mockOrderService.countCompletedOrders.mockResolvedValue(80);
      mockOrderService.sumCompletedSales.mockResolvedValue(
        new Prisma.Decimal('1234567.89'),
      );
      mockUserService.countAllUsers.mockResolvedValue(500);
      mockSellerService.countAllSellers.mockResolvedValue(42);

      const result = await service.getOverview();

      expect(result.totalOrders).toBe(120);
      expect(result.completedOrders).toBe(80);
      expect(result.totalSales.toString()).toBe('1234567.89');
      expect(result.totalUsers).toBe(500);
      expect(result.totalSellers).toBe(42);
    });

    it('when_no_completed_orders_then_zero_decimal_sales', async () => {
      mockOrderService.countAllOrders.mockResolvedValue(0);
      mockOrderService.countCompletedOrders.mockResolvedValue(0);
      mockOrderService.sumCompletedSales.mockResolvedValue(new Prisma.Decimal(0));
      mockUserService.countAllUsers.mockResolvedValue(0);
      mockSellerService.countAllSellers.mockResolvedValue(0);

      const result = await service.getOverview();

      expect(result.totalSales.toString()).toBe('0');
    });
  });

  // ── seller stats ────────────────────────────────────────────────────

  describe('getSellerStats', () => {
    it('when_approved_seller_then_returns_own_summary', async () => {
      mockSellerService.getApprovedSeller.mockResolvedValue({
        id: 'seller-1',
        userId: 'user-1',
      });
      mockOrderService.getSellerSalesSummary.mockResolvedValue({
        salesTotal: new Prisma.Decimal('99999.50'),
        orderCount: 7,
      });

      const result = await service.getSellerStats('user-1');

      // 본인 격리: getApprovedSeller 가 반환한 sellerId 로만 집계 호출
      expect(mockSellerService.getApprovedSeller).toHaveBeenCalledWith('user-1');
      expect(mockOrderService.getSellerSalesSummary).toHaveBeenCalledWith('seller-1');
      expect(result.salesTotal.toString()).toBe('99999.5');
      expect(result.orderCount).toBe(7);
    });

    it('when_not_approved_seller_then_ForbiddenException', async () => {
      mockSellerService.getApprovedSeller.mockRejectedValue(
        new ForbiddenException('Seller is not approved'),
      );

      await expect(service.getSellerStats('user-x')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockOrderService.getSellerSalesSummary).not.toHaveBeenCalled();
    });
  });
});
