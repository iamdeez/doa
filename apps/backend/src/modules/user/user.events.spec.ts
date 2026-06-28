/**
 * UserEventsHandler 단위 테스트 — [env:unit]
 *
 * 대상 SC: SC-011 (최근 본 상품 기록 — product.viewed 이벤트)
 * 검증 방법: Jest mock (UserService)
 *
 * production: UserEventsHandler.handleProductViewed(event: {userId, productId})
 *   → userService.recordProductView(userId, productId) 위임
 *   → userRepository.upsertProductView(userId, productId) (viewedAt 은 repository 내부에서 new Date())
 *
 * TDD Red → Green (v1.0.0/002-catalog 5b 수정).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UserEventsHandler } from './user.events';
import { UserService } from './user.service';

// ─────────────────────────────────────────────
// Mock 팩토리 (production UserService 메서드 그대로)
// ─────────────────────────────────────────────
const mockUserService = {
  recordProductView: jest.fn(),
};

describe('UserEventsHandler — product.viewed 이벤트 처리', () => {
  let handler: UserEventsHandler;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserEventsHandler,
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    handler = module.get<UserEventsHandler>(UserEventsHandler);
  });

  // ─────────────────────────────────────────────
  // SC-011: product.viewed 이벤트 수신 → 최근 본 상품 upsert
  // ─────────────────────────────────────────────
  describe('SC-011: handleProductViewed — 최근 본 상품 upsert', () => {
    it('when_product_viewed_event_then_upsert_view_record', async () => {
      /**
       * SC-011 (FR-009 관련):
       * product.viewed 이벤트 수신 시 (userId, productId) 로 최근 본 상품 기록을 upsert.
       * production UserEventsHandler.handleProductViewed()는
       *   userService.recordProductView(userId, productId) 를 호출한다.
       * event payload: { userId, productId } (viewedAt 없음 — repository 내부에서 new Date() 사용)
       */
      mockUserService.recordProductView.mockResolvedValue(undefined);

      await handler.handleProductViewed({
        userId: 'user-001',
        productId: 'product-001',
      });

      expect(mockUserService.recordProductView).toHaveBeenCalledWith(
        'user-001',
        'product-001',
      );
    });

    it('when_product_viewed_again_then_viewedAt_updated', async () => {
      /**
       * SC-011 (FR-009 관련):
       * 동일 (userId, productId) 쌍에 대한 재방문 시 viewedAt 갱신 (upsert).
       * recordProductView 는 update-or-create 시멘틱으로 동작
       * (repository.upsertProductView가 update.viewedAt=new Date() 처리).
       * 핸들러는 두 번 호출 시 두 번 모두 recordProductView 를 위임한다.
       */
      mockUserService.recordProductView.mockResolvedValue(undefined);

      await handler.handleProductViewed({
        userId: 'user-001',
        productId: 'product-001',
      });
      await handler.handleProductViewed({
        userId: 'user-001',
        productId: 'product-001',
      });

      // 두 번 모두 recordProductView 가 호출됨 (upsert semantics 는 service/repo 레벨에서 보장)
      expect(mockUserService.recordProductView).toHaveBeenCalledTimes(2);
      expect(mockUserService.recordProductView).toHaveBeenNthCalledWith(
        1,
        'user-001',
        'product-001',
      );
    });
  });
});
