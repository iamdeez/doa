/**
 * ReviewService 단위 테스트 — [env:unit]
 *
 * 대상 SC: SC-030~041 (004 spec)
 * 검증 방법: Jest mock (ReviewRepository, OrderService, EventEmitter2)
 * TDD: Development Agent 가 ReviewService 구현 완료 후 실행 가능.
 *
 * PATCH-03: review 권한 검증 순서(404→403→422→409) mock 이 production 실제 경로 재현.
 *   - null orderItem → 404 (소유권 미확인)
 *   - orderItem 있으나 userId 불일치 → 403 (status 미확인)
 *   - orderItem 있고 userId 일치하나 status != completed → 422
 *   - 모두 통과 후 P2002 → 409
 *
 * Canonical 심볼 (tasks.md Test Authoring Contract):
 *   ReviewService.createReview(userId, { orderItemId, rating, content })
 *   ReviewService.updateReview(userId, reviewId, { rating?, content? })
 *   ReviewService.deleteReview(userId, reviewId)
 *   ReviewService.listProductReviews(productId, cursor?, take?)
 *   ReviewService.listMyReviews(userId, cursor?, take?)
 */

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus, Prisma } from '@prisma/client';
import { ReviewService } from './review.service';
import { ReviewRepository } from './review.repository';
import { OrderService } from '../order/order.service';

// ─────────────────────────────────────────────
// Mock 팩토리
// ─────────────────────────────────────────────
const mockReviewRepository = {
  createReview: jest.fn(),
  findReviewById: jest.fn(),
  updateReview: jest.fn(),
  deleteReview: jest.fn(),
  listByProduct: jest.fn(),
  listByUser: jest.fn(),
};

/** OrderService: getOrderItemForReview DI 경유 (P-001 경계 준수) */
const mockOrderService = {
  getOrderItemForReview: jest.fn(),
};

/** EventEmitter2: review.created 이벤트 emit 검증 */
const mockEventEmitter = {
  emit: jest.fn(),
};

// ─────────────────────────────────────────────
// 고정 픽스처
// ─────────────────────────────────────────────
const FIXED_USER_ID = 'user-id-reviewer-001';
const FIXED_OTHER_USER_ID = 'user-id-other-002';
const FIXED_ORDER_ID = 'order-id-001';
const FIXED_ITEM_ID = 'order-item-id-001';
const FIXED_REVIEW_ID = 'review-id-001';
const FIXED_PRODUCT_ID = 'product-id-001';
const FIXED_SELLER_ID = 'seller-id-001';

/** completed 주문에 속한 orderItem 픽스처 (getOrderItemForReview 반환값) */
const FIXED_COMPLETED_ORDER_ITEM = {
  id: FIXED_ITEM_ID,
  orderId: FIXED_ORDER_ID,
  variantId: 'variant-001',
  productId: FIXED_PRODUCT_ID,
  sellerId: FIXED_SELLER_ID,
  quantity: 1,
  unitPrice: new Prisma.Decimal('15000'),
  optionName: '색상',
  optionValue: '블랙',
  productTitle: '테스트 상품',
  sku: 'SKU-001',
  order: {
    id: FIXED_ORDER_ID,
    userId: FIXED_USER_ID,
    status: OrderStatus.completed,
  },
};

/** createReview 성공 시 repository 반환 픽스처 */
const FIXED_REVIEW = {
  id: FIXED_REVIEW_ID,
  orderItemId: FIXED_ITEM_ID,
  orderId: FIXED_ORDER_ID,
  userId: FIXED_USER_ID,
  productId: FIXED_PRODUCT_ID,
  sellerId: FIXED_SELLER_ID,
  rating: 4,
  content: '좋은 상품이에요',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

/** P2002 에러 시뮬레이션 (reviews.orderItemId @unique 위반) */
const P2002_ERROR = new Prisma.PrismaClientKnownRequestError(
  'Unique constraint failed on the fields: (`orderItemId`)',
  { code: 'P2002', clientVersion: '6.0.0' },
);

describe('ReviewService', () => {
  let service: ReviewService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: ReviewRepository, useValue: mockReviewRepository },
        { provide: OrderService, useValue: mockOrderService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
  });

  // ─────────────────────────────────────────────
  // SC-030, SC-041: 리뷰 생성 happy path + 이벤트
  // ─────────────────────────────────────────────
  describe('SC-030: createReview — DB 저장 성공', () => {
    it('when_createReview_then_stored_and_returned', async () => {
      /**
       * SC-030 (FR-021 관련):
       * 구매 완료된 주문 항목에 대해 리뷰 생성 성공.
       * orderItem 조회 → 소유권 확인 → 완료 상태 확인 → reviewRepository.createReview 호출.
       */
      mockOrderService.getOrderItemForReview.mockResolvedValue(FIXED_COMPLETED_ORDER_ITEM);
      mockReviewRepository.createReview.mockResolvedValue(FIXED_REVIEW);

      const result = await service.createReview(FIXED_USER_ID, {
        orderItemId: FIXED_ITEM_ID,
        rating: 4,
        content: '좋은 상품이에요',
      });

      expect(mockOrderService.getOrderItemForReview).toHaveBeenCalledWith(FIXED_ITEM_ID);
      expect(mockReviewRepository.createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          orderItemId: FIXED_ITEM_ID,
          userId: FIXED_USER_ID,
          productId: FIXED_PRODUCT_ID,
          sellerId: FIXED_SELLER_ID,
          rating: 4,
          content: '좋은 상품이에요',
        }),
      );
      expect(result).toEqual(FIXED_REVIEW);
    });
  });

  describe('SC-041: createReview — review.created 이벤트 6개 필드', () => {
    it('when_createReview_then_event_has_6_fields', async () => {
      /**
       * SC-041 (FR-023 관련):
       * 리뷰 생성 성공 시 'review.created' 이벤트가 6개 필드와 함께 emit 된다:
       *   reviewId, orderItemId, orderId, productId, userId, rating
       */
      mockOrderService.getOrderItemForReview.mockResolvedValue(FIXED_COMPLETED_ORDER_ITEM);
      mockReviewRepository.createReview.mockResolvedValue(FIXED_REVIEW);

      await service.createReview(FIXED_USER_ID, {
        orderItemId: FIXED_ITEM_ID,
        rating: 4,
        content: '좋은 상품이에요',
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'review.created',
        expect.objectContaining({
          reviewId: FIXED_REVIEW_ID,
          orderItemId: FIXED_ITEM_ID,
          orderId: FIXED_ORDER_ID,
          productId: FIXED_PRODUCT_ID,
          userId: FIXED_USER_ID,
          rating: 4,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // SC-031: orderItem null → 404
  // ─────────────────────────────────────────────
  describe('SC-031: createReview — orderItem null → NotFoundException(404)', () => {
    it('when_orderItem_not_found_then_NotFoundException', async () => {
      /**
       * SC-031 (FR-021 관련):
       * getOrderItemForReview 반환값 null → NotFoundException(404).
       *
       * PATCH-03: null 이면 소유권·상태 체크 없이 404. production 경로 재현.
       */
      mockOrderService.getOrderItemForReview.mockResolvedValue(null);

      await expect(
        service.createReview(FIXED_USER_ID, {
          orderItemId: FIXED_ITEM_ID,
          rating: 4,
          content: '리뷰',
        }),
      ).rejects.toThrow(NotFoundException);

      // 404 이후 추가 검증 없음 — repository 호출 안 됨
      expect(mockReviewRepository.createReview).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // SC-032: orderUserId 불일치 → 403
  // ─────────────────────────────────────────────
  describe('SC-032: createReview — orderUserId 불일치 → ForbiddenException(403)', () => {
    it('when_orderUserId_mismatch_then_ForbiddenException', async () => {
      /**
       * SC-032 (FR-021b 관련):
       * orderItem.order.userId !== userId → ForbiddenException(403).
       *
       * PATCH-03: userId 불일치면 status 체크 없이 403. production 경로 재현.
       */
      mockOrderService.getOrderItemForReview.mockResolvedValue({
        ...FIXED_COMPLETED_ORDER_ITEM,
        order: {
          ...FIXED_COMPLETED_ORDER_ITEM.order,
          userId: FIXED_OTHER_USER_ID, // 다른 사용자 소유
        },
      });

      await expect(
        service.createReview(FIXED_USER_ID, {
          orderItemId: FIXED_ITEM_ID,
          rating: 4,
          content: '리뷰',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────
  // SC-033: orderStatus !== completed → 422
  // ─────────────────────────────────────────────
  describe('SC-033: createReview — orderStatus != completed → UnprocessableEntityException(422)', () => {
    it('when_orderStatus_not_completed_then_UnprocessableEntityException', async () => {
      /**
       * SC-033 (FR-021a 관련):
       * order.status !== completed (예: 'pending') → UnprocessableEntityException(422).
       * 소유권은 일치하지만 구매 완료 전 리뷰 시도.
       */
      mockOrderService.getOrderItemForReview.mockResolvedValue({
        ...FIXED_COMPLETED_ORDER_ITEM,
        order: {
          ...FIXED_COMPLETED_ORDER_ITEM.order,
          userId: FIXED_USER_ID, // 소유권 일치
          status: OrderStatus.pending, // 미완료 상태
        },
      });

      await expect(
        service.createReview(FIXED_USER_ID, {
          orderItemId: FIXED_ITEM_ID,
          rating: 4,
          content: '리뷰',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ─────────────────────────────────────────────
  // SC-034: P2002 unique 위반 → 409
  // ─────────────────────────────────────────────
  describe('SC-034: createReview — P2002 중복 → ConflictException(409)', () => {
    it('when_P2002_then_ConflictException', async () => {
      /**
       * SC-034 (FR-021c 관련, ADR-009):
       * reviews.orderItemId @unique 위반 시 P2002 에러 → ConflictException(409).
       * 동일 orderItemId 에 2번째 리뷰 시도.
       */
      mockOrderService.getOrderItemForReview.mockResolvedValue(FIXED_COMPLETED_ORDER_ITEM);
      mockReviewRepository.createReview.mockRejectedValue(P2002_ERROR);

      await expect(
        service.createReview(FIXED_USER_ID, {
          orderItemId: FIXED_ITEM_ID,
          rating: 4,
          content: '두 번째 리뷰',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────
  // SC-035: 권한 검증 순서 (PATCH-03)
  // ─────────────────────────────────────────────
  describe('SC-035: createReview 권한 검증 순서 — 404→403→422→409', () => {
    it('when_null_orderItem_then_404_not_403', async () => {
      /**
       * SC-035 (FR-021 관련):
       * PATCH-03: null orderItem 이면 소유권 체크(403) 없이 즉시 404.
       * production 검증 순서: null → 404 (userId 체크 전).
       */
      mockOrderService.getOrderItemForReview.mockResolvedValue(null);

      await expect(
        service.createReview(FIXED_USER_ID, {
          orderItemId: FIXED_ITEM_ID,
          rating: 4,
          content: '리뷰',
        }),
      ).rejects.toThrow(NotFoundException); // 403 아닌 404
    });

    it('when_userId_mismatch_and_status_not_completed_then_403_not_422', async () => {
      /**
       * SC-035 (FR-021b vs FR-021a):
       * PATCH-03: userId 불일치 + status != completed 동시 시 403 (ForbiddenException) 먼저.
       * 422(UnprocessableEntityException) 는 소유권 통과 후에만 체크.
       */
      mockOrderService.getOrderItemForReview.mockResolvedValue({
        ...FIXED_COMPLETED_ORDER_ITEM,
        order: {
          id: FIXED_ORDER_ID,
          userId: FIXED_OTHER_USER_ID, // 불일치
          status: OrderStatus.pending,  // 미완료
        },
      });

      await expect(
        service.createReview(FIXED_USER_ID, {
          orderItemId: FIXED_ITEM_ID,
          rating: 4,
          content: '리뷰',
        }),
      ).rejects.toThrow(ForbiddenException); // 422 아닌 403
    });
  });

  // ─────────────────────────────────────────────
  // SC-036: 리뷰 수정 — 작성자만 가능
  // ─────────────────────────────────────────────
  describe('SC-036: updateReview — 작성자만 수정 가능', () => {
    it('when_updateReview_by_author_then_ok', async () => {
      /**
       * SC-036 (FR-024 관련):
       * 리뷰 작성자가 내용/별점을 수정할 수 있다.
       */
      mockReviewRepository.findReviewById.mockResolvedValue(FIXED_REVIEW);
      const updatedReview = { ...FIXED_REVIEW, content: '수정된 리뷰', rating: 5 };
      mockReviewRepository.updateReview.mockResolvedValue(updatedReview);

      const result = await service.updateReview(FIXED_USER_ID, FIXED_REVIEW_ID, {
        content: '수정된 리뷰',
        rating: 5,
      });

      expect(mockReviewRepository.updateReview).toHaveBeenCalledWith(
        FIXED_REVIEW_ID,
        { content: '수정된 리뷰', rating: 5 },
      );
      expect(result).toEqual(updatedReview);
    });

    it('when_updateReview_by_other_then_403', async () => {
      /**
       * SC-036 (FR-024 관련) Error:
       * 타인이 리뷰 수정 시도 → ForbiddenException(403).
       */
      mockReviewRepository.findReviewById.mockResolvedValue(FIXED_REVIEW);

      await expect(
        service.updateReview(FIXED_OTHER_USER_ID, FIXED_REVIEW_ID, { content: '수정 시도' }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockReviewRepository.updateReview).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // SC-037: 리뷰 삭제 — 작성자만 가능
  // ─────────────────────────────────────────────
  describe('SC-037: deleteReview — 작성자만 삭제 가능', () => {
    it('when_deleteReview_by_author_then_ok', async () => {
      /**
       * SC-037 (FR-024 관련):
       * 리뷰 작성자가 리뷰를 삭제할 수 있다.
       */
      mockReviewRepository.findReviewById.mockResolvedValue(FIXED_REVIEW);
      mockReviewRepository.deleteReview.mockResolvedValue(undefined);

      await service.deleteReview(FIXED_USER_ID, FIXED_REVIEW_ID);

      expect(mockReviewRepository.deleteReview).toHaveBeenCalledWith(FIXED_REVIEW_ID);
    });

    it('when_deleteReview_by_other_then_403', async () => {
      /**
       * SC-037 (FR-024 관련) Error:
       * 타인이 리뷰 삭제 시도 → ForbiddenException(403).
       */
      mockReviewRepository.findReviewById.mockResolvedValue(FIXED_REVIEW);

      await expect(
        service.deleteReview(FIXED_OTHER_USER_ID, FIXED_REVIEW_ID),
      ).rejects.toThrow(ForbiddenException);

      expect(mockReviewRepository.deleteReview).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // SC-038: 리뷰 삭제 — 존재하지 않으면 404
  // ─────────────────────────────────────────────
  describe('SC-038: deleteReview — 리뷰 미존재 → NotFoundException(404)', () => {
    it('when_review_not_found_for_delete_then_NotFoundException', async () => {
      /**
       * SC-038 (FR-024 관련):
       * 존재하지 않는 reviewId 로 삭제 시도 → NotFoundException(404).
       */
      mockReviewRepository.findReviewById.mockResolvedValue(null);

      await expect(
        service.deleteReview(FIXED_USER_ID, 'nonexistent-review-id'),
      ).rejects.toThrow(NotFoundException);

      expect(mockReviewRepository.deleteReview).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // SC-039: 상품별 리뷰 목록
  // ─────────────────────────────────────────────
  describe('SC-039: listProductReviews — 상품별 리뷰 목록 조회', () => {
    it('when_listProductReviews_then_returns_list', async () => {
      /**
       * SC-039 (FR-025 관련):
       * listProductReviews(productId) → reviewRepository.listByProduct 호출 후 결과 반환.
       */
      const mockResult = { items: [FIXED_REVIEW], nextCursor: null };
      mockReviewRepository.listByProduct.mockResolvedValue(mockResult);

      const result = await service.listProductReviews(FIXED_PRODUCT_ID);

      expect(mockReviewRepository.listByProduct).toHaveBeenCalledWith(
        FIXED_PRODUCT_ID,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockResult);
    });
  });

  // ─────────────────────────────────────────────
  // SC-040: 내 리뷰 목록
  // ─────────────────────────────────────────────
  describe('SC-040: listMyReviews — 내 리뷰 목록 조회', () => {
    it('when_listMyReviews_then_returns_list', async () => {
      /**
       * SC-040 (FR-026 관련):
       * listMyReviews(userId) → reviewRepository.listByUser 호출 후 결과 반환.
       */
      const mockResult = { items: [FIXED_REVIEW], nextCursor: null };
      mockReviewRepository.listByUser.mockResolvedValue(mockResult);

      const result = await service.listMyReviews(FIXED_USER_ID);

      expect(mockReviewRepository.listByUser).toHaveBeenCalledWith(
        FIXED_USER_ID,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockResult);
    });
  });
});
