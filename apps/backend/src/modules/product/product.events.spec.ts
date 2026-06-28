/**
 * ProductEventsHandler 단위 테스트 — [env:unit]
 *
 * 대상 SC: SC-030, SC-031
 * 검증 방법: Jest mock (ProductRepository)
 *
 * SC-030: 모든 variant 재고 합계 0 → 상품 OUT_OF_STOCK 자동 전환
 * SC-031: OUT_OF_STOCK 상품 재고 입고 0 초과 → ACTIVE 자동 전환
 *
 * production: ProductEventsHandler.handleStockChanged(event: {productId, totalStock})
 *   - findById(productId) → product.status 확인
 *   - ACTIVE + totalStock===0 → updateStatus(productId, OUT_OF_STOCK)
 *   - OUT_OF_STOCK + totalStock>0 → updateStatus(productId, ACTIVE)
 *   - DRAFT/INACTIVE → 전이 없음 (멱등)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ProductEventsHandler } from './product.events';
import { ProductRepository } from './product.repository';

// ─────────────────────────────────────────────
// Mock 팩토리 (production ProductRepository 메서드 그대로)
// ─────────────────────────────────────────────
const mockProductRepository = {
  findById: jest.fn(),
  updateStatus: jest.fn(),
};

// ─────────────────────────────────────────────
// 고정 픽스처
// ─────────────────────────────────────────────
const FIXED_PRODUCT_ID = 'product-fixed-id';
const FIXED_VARIANT_ID = 'variant-fixed-id'; // 이벤트 출처 참조용 (payload에 포함 안 됨)

const FIXED_PRODUCT_ACTIVE = {
  id: FIXED_PRODUCT_ID,
  sellerId: 'seller-id',
  status: 'ACTIVE',
};

const FIXED_PRODUCT_OOS = {
  id: FIXED_PRODUCT_ID,
  sellerId: 'seller-id',
  status: 'OUT_OF_STOCK',
};

describe('ProductEventsHandler — inventory.stock-changed 이벤트 처리', () => {
  let handler: ProductEventsHandler;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductEventsHandler,
        { provide: ProductRepository, useValue: mockProductRepository },
      ],
    }).compile();

    handler = module.get<ProductEventsHandler>(ProductEventsHandler);
  });

  // ─────────────────────────────────────────────
  // SC-030: variant 재고 합계 0 → OUT_OF_STOCK
  // ─────────────────────────────────────────────
  describe('SC-030: handleStockChanged — 재고 합계 0 → OUT_OF_STOCK', () => {
    it('when_all_variant_stock_zero_then_product_out_of_stock', async () => {
      /**
       * SC-030 (FR-023 관련):
       * inventory.stock-changed 이벤트 수신 시 totalStock===0 이고
       * product.status===ACTIVE 이면 OUT_OF_STOCK 으로 자동 전환.
       * event payload: { productId, totalStock }
       */
      mockProductRepository.findById.mockResolvedValue(FIXED_PRODUCT_ACTIVE);
      mockProductRepository.updateStatus.mockResolvedValue({
        ...FIXED_PRODUCT_ACTIVE,
        status: 'OUT_OF_STOCK',
      });

      await handler.handleStockChanged({
        productId: FIXED_PRODUCT_ID,
        totalStock: 0,
      });

      expect(mockProductRepository.updateStatus).toHaveBeenCalledWith(
        FIXED_PRODUCT_ID,
        'OUT_OF_STOCK',
      );
    });

    it('when_stock_changed_but_total_still_positive_then_no_status_change', async () => {
      /**
       * SC-030 (FR-023 관련):
       * ACTIVE 상품 재고가 변경되었으나 totalStock>0 이면 상태 변경 없음.
       */
      mockProductRepository.findById.mockResolvedValue(FIXED_PRODUCT_ACTIVE);

      await handler.handleStockChanged({
        productId: FIXED_PRODUCT_ID,
        totalStock: 5,
      });

      expect(mockProductRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // SC-031: OUT_OF_STOCK 상품 재고 입고 → ACTIVE
  // ─────────────────────────────────────────────
  describe('SC-031: handleStockChanged — OUT_OF_STOCK + 재고 > 0 → ACTIVE', () => {
    it('when_oos_product_gets_stock_then_active', async () => {
      /**
       * SC-031 (FR-024 관련):
       * OUT_OF_STOCK 상태 상품에 재고 입고로 totalStock>0 이 되면
       * product.status 를 ACTIVE 로 자동 변경.
       */
      mockProductRepository.findById.mockResolvedValue(FIXED_PRODUCT_OOS);
      mockProductRepository.updateStatus.mockResolvedValue({
        ...FIXED_PRODUCT_OOS,
        status: 'ACTIVE',
      });

      await handler.handleStockChanged({
        productId: FIXED_PRODUCT_ID,
        totalStock: 10,
      });

      expect(mockProductRepository.updateStatus).toHaveBeenCalledWith(
        FIXED_PRODUCT_ID,
        'ACTIVE',
      );
    });

    it('when_non_oos_product_stock_added_then_no_change', async () => {
      /**
       * SC-031 (FR-024 관련):
       * ACTIVE 상태 상품에 재고 추가(totalStock>0) → 상태 변경 없음.
       * OUT_OF_STOCK 이 아니므로 ACTIVE 전환 트리거 없음.
       */
      mockProductRepository.findById.mockResolvedValue(FIXED_PRODUCT_ACTIVE);

      await handler.handleStockChanged({
        productId: FIXED_PRODUCT_ID,
        totalStock: 15,
      });

      expect(mockProductRepository.updateStatus).not.toHaveBeenCalled();
    });
  });
});
