/**
 * InventoryService 단위 테스트 — [env:unit]
 *
 * 대상 SC: SC-041, SC-042, SC-046
 * (SC-043,044,045 는 test/static/ — 정적 코드 검증)
 * 검증 방법: Jest mock (InventoryRepository, EventEmitter2)
 *
 * 참고: SC-041 quantity<=0 유효성 검사는 StockInDto @Min(1) (DTO 레벨) 로 처리.
 *   서비스 레벨에서는 유효한 quantity(>0)가 들어온다고 가정.
 *   DTO 유효성은 test/static/ 에서 정적 검증.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';

// ─────────────────────────────────────────────
// Mock 팩토리 (production InventoryRepository 메서드 그대로)
// ─────────────────────────────────────────────
const mockInventoryRepository = {
  findByVariant: jest.fn(),
  createInventory: jest.fn(),
  increment: jest.fn(),
  conditionalDecrement: jest.fn(),
  sumQuantityByProduct: jest.fn(),
  appendLog: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

// ─────────────────────────────────────────────
// 고정 픽스처
// ─────────────────────────────────────────────
const FIXED_VARIANT_ID = 'variant-fixed-id';
const FIXED_PRODUCT_ID = 'product-fixed-id';
const FIXED_ORDER_ID = 'order-fixed-id';

const FIXED_INVENTORY = {
  variantId: FIXED_VARIANT_ID,
  productId: FIXED_PRODUCT_ID,
  quantity: 10,
};

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: InventoryRepository, useValue: mockInventoryRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  // ─────────────────────────────────────────────
  // SC-041: POST /inventory/:variantId/stock-in → 재고 증가 + 로그 생성
  // ─────────────────────────────────────────────
  describe('SC-041: stockIn — 입고 처리 + inventory_logs 생성', () => {
    it('when_stock_in_then_stock_increased_and_log_created', async () => {
      /**
       * SC-041 (FR-030 관련):
       * POST /inventory/:variantId/stock-in {quantity} 호출 시
       * variant 재고 증가 + inventory_logs 에 입고 로그 생성.
       * production stockIn(variantId, quantity):
       *   findByVariant → increment → appendLog → emitStockChanged(sumQuantityByProduct).
       * appendLog 필드: delta (not quantity).
       * quantity<=0 유효성 검사는 DTO @Min(1) 레벨 — 서비스 레벨 아님.
       */
      mockInventoryRepository.findByVariant.mockResolvedValue(FIXED_INVENTORY);
      mockInventoryRepository.increment.mockResolvedValue({
        ...FIXED_INVENTORY,
        quantity: 15,
      });
      mockInventoryRepository.appendLog.mockResolvedValue({
        id: 'log-id',
        variantId: FIXED_VARIANT_ID,
        productId: FIXED_PRODUCT_ID,
        type: 'STOCK_IN',
        delta: 5,
        createdAt: new Date(),
      });
      // emitStockChanged 내부에서 sumQuantityByProduct 호출
      mockInventoryRepository.sumQuantityByProduct.mockResolvedValue(15);

      await service.stockIn(FIXED_VARIANT_ID, 5);

      expect(mockInventoryRepository.increment).toHaveBeenCalledWith(
        FIXED_VARIANT_ID,
        5,
      );
      // appendLog는 delta 필드로 호출됨 (quantity 아님)
      expect(mockInventoryRepository.appendLog).toHaveBeenCalledWith(
        expect.objectContaining({
          variantId: FIXED_VARIANT_ID,
          type: 'STOCK_IN',
          delta: 5,
        }),
      );
    });

    it('when_stock_in_variant_not_found_then_bad_request', async () => {
      /**
       * SC-041 (FR-030 관련) Edge:
       * 존재하지 않는 variant 에 입고 시도 시 BadRequestException.
       * production: findByVariant → null → BadRequestException.
       */
      mockInventoryRepository.findByVariant.mockResolvedValue(null);

      await expect(
        service.stockIn(FIXED_VARIANT_ID, 5),
      ).rejects.toThrow('Inventory not found for variant');
    });
  });

  // ─────────────────────────────────────────────
  // SC-042: GET /inventory/:variantId/stock → 현재 재고 반환
  // ─────────────────────────────────────────────
  describe('SC-042: getStock — 현재 재고 수량 반환', () => {
    it('when_get_stock_then_current_quantity', async () => {
      /**
       * SC-042 (FR-031 관련):
       * GET /inventory/:variantId/stock 시 현재 재고 수량 반환.
       * production getStock(variantId): findByVariant → returns inv.quantity (number).
       * 반환 타입 number, 객체 아님.
       */
      mockInventoryRepository.findByVariant.mockResolvedValue({
        ...FIXED_INVENTORY,
        quantity: 42,
      });

      const result = await service.getStock(FIXED_VARIANT_ID);

      expect(mockInventoryRepository.findByVariant).toHaveBeenCalledWith(
        FIXED_VARIANT_ID,
      );
      // production returns number (inv.quantity), not an object
      expect(result).toBe(42);
    });

    it('when_variant_not_found_then_zero', async () => {
      /**
       * SC-042 (FR-031 관련) Edge:
       * 재고 행이 없으면 0 반환 (production: if (!inv) return 0).
       */
      mockInventoryRepository.findByVariant.mockResolvedValue(null);

      const result = await service.getStock(FIXED_VARIANT_ID);

      expect(result).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // SC-046: decreaseStock — 재고 부족 시 InsufficientStockException
  // ─────────────────────────────────────────────
  describe('SC-046: decreaseStock — 재고 부족 InsufficientStockException', () => {
    it('when_decrease_stock_sufficient_then_ok', async () => {
      /**
       * SC-046 (FR-035 관련):
       * decreaseStock 호출 시 재고 충분하면 정상 감소 + 로그 생성.
       * production: findByVariant → conditionalDecrement(count=1) → appendLog → emitStockChanged.
       */
      mockInventoryRepository.findByVariant.mockResolvedValue(FIXED_INVENTORY);
      // conditionalDecrement: Prisma updateMany 기반 CAS — 성공 시 count=1
      mockInventoryRepository.conditionalDecrement.mockResolvedValue({ count: 1 });
      mockInventoryRepository.appendLog.mockResolvedValue({
        id: 'log-id',
        variantId: FIXED_VARIANT_ID,
        productId: FIXED_PRODUCT_ID,
        type: 'DECREASE',
        delta: -3,
      });
      mockInventoryRepository.sumQuantityByProduct.mockResolvedValue(7);

      await expect(
        service.decreaseStock(FIXED_VARIANT_ID, 3, FIXED_ORDER_ID),
      ).resolves.toBeUndefined();

      expect(mockInventoryRepository.conditionalDecrement).toHaveBeenCalledWith(
        FIXED_VARIANT_ID,
        3,
      );
    });

    it('when_decrease_stock_insufficient_then_InsufficientStockException', async () => {
      /**
       * SC-046 (FR-035 관련):
       * decreaseStock 호출 시 재고 부족(count=0) → InsufficientStockException throw.
       * conditionalDecrement 에서 WHERE stock >= quantity 조건 불충족 시 count=0 반환.
       * InsufficientStockException.message = 'Insufficient stock' (대문자 I).
       */
      mockInventoryRepository.findByVariant.mockResolvedValue(FIXED_INVENTORY);
      // count=0 → CAS 실패 → 재고 부족
      mockInventoryRepository.conditionalDecrement.mockResolvedValue({ count: 0 });

      await expect(
        service.decreaseStock(FIXED_VARIANT_ID, 100, FIXED_ORDER_ID),
      ).rejects.toThrow(
        expect.objectContaining({ message: expect.stringContaining('Insufficient') }),
      );
    });

    it('when_decrease_stock_exact_then_ok', async () => {
      /**
       * SC-046 (FR-035 관련) Edge:
       * 재고와 요청 수량이 정확히 일치할 때 정상 처리 (count=1).
       * stock = quantity 인 경계값 케이스.
       */
      mockInventoryRepository.findByVariant.mockResolvedValue({
        ...FIXED_INVENTORY,
        quantity: 10,
      });
      mockInventoryRepository.conditionalDecrement.mockResolvedValue({ count: 1 });
      mockInventoryRepository.appendLog.mockResolvedValue({
        id: 'log-id',
        variantId: FIXED_VARIANT_ID,
        productId: FIXED_PRODUCT_ID,
        type: 'DECREASE',
        delta: -10,
      });
      mockInventoryRepository.sumQuantityByProduct.mockResolvedValue(0);

      await expect(
        service.decreaseStock(FIXED_VARIANT_ID, 10, FIXED_ORDER_ID), // stock=10, req=10
      ).resolves.toBeUndefined();
    });
  });
});
