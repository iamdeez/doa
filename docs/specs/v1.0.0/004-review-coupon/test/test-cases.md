---
작성: Test Agent (AUTHORING)
버전: v1.0
최종 수정: 2026-06-29 14:18
상태: 작성중
---

# Test Cases: 004-review-coupon

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
  - [쿠폰 생성·발급 (SC-001~011)](#쿠폰-생성발급-sc-001011)
  - [쿠폰-주문 통합 (SC-012~024)](#쿠폰-주문-통합-sc-012024)
  - [리뷰 CRUD (SC-030~041)](#리뷰-crud-sc-030041)
  - [NFR 정적 검증 (SC-050~055)](#nfr-정적-검증-sc-050055)
- [외부 의존성 명시](#외부-의존성-명시)
- [미커버 항목 (사전 분류 — 4-카테고리)](#미커버-항목-사전-분류--4-카테고리)

---

## SC × 시나리오 매트릭스

### 쿠폰 생성·발급 (SC-001~011)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-001 | 어드민이 FIXED 쿠폰 생성 → DB 저장 | `when_admin_creates_FIXED_coupon_then_stored` | — | — | coupon.service.spec.ts::when_admin_creates_FIXED_coupon_then_stored | [env:unit] |
| SC-002 | 어드민이 PERCENTAGE 쿠폰 생성 → DB 저장 | `when_admin_creates_PERCENTAGE_coupon_then_stored` | — | — | coupon.service.spec.ts::when_admin_creates_PERCENTAGE_coupon_then_stored | [env:unit] |
| SC-003 | 셀러가 FIXED 쿠폰 생성 → issuerType=SELLER | `when_seller_creates_coupon_then_issuerType_SELLER` | — | — | coupon.service.spec.ts::when_seller_creates_coupon_then_issuerType_SELLER | [env:unit] |
| SC-004 | 어드민이 사용자에게 쿠폰 발급 → UserCoupon 생성 | `when_admin_issues_coupon_then_UserCoupon_created` | — | — | coupon.service.spec.ts::when_admin_issues_coupon_then_UserCoupon_created | [env:unit] |
| SC-005 | 셀러가 자신의 쿠폰만 발급 가능 | `when_seller_issues_own_coupon_then_ok` | — | `when_seller_issues_others_coupon_then_403` | coupon.service.spec.ts | [env:unit] |
| SC-006 | 발급 한도 초과 시 발급 거부 (issuedCount >= maxIssuable) | — | `when_issuedCount_at_max_then_rejected` | `when_issuedCount_exceeds_max_then_409` | coupon.service.spec.ts::when_issuedCount_exceeds_maxIssuable_then_ConflictException | [env:unit] |
| SC-007 | 내 쿠폰 목록 조회 | `when_list_my_coupons_then_returns_list` | — | — | coupon.service.spec.ts::when_list_my_coupons_then_returns_list | [env:unit] |
| SC-008 | 셀러 쿠폰 목록 조회 | `when_list_seller_coupons_then_returns_list` | — | — | coupon.service.spec.ts::when_list_seller_coupons_then_returns_list | [env:unit] |
| SC-009 | FIXED 쿠폰 할인액 계산: min(discountValue, totalAmount) | `when_FIXED_discount_then_exact_discountValue` | `when_FIXED_discount_exceeds_total_then_capped` | `when_coupon_status_not_unused_then_422` | coupon.service.spec.ts::when_FIXED_discount_calculates_correctly | [env:unit] |
| SC-010 | PERCENTAGE 쿠폰 할인액 계산: floor(total×rate/100), maxDiscount 캡 | `when_PERCENTAGE_discount_then_floored` | `when_PERCENTAGE_exceeds_maxDiscount_then_capped` | — | coupon.service.spec.ts::when_PERCENTAGE_discount_calculates_correctly | [env:unit] |
| SC-011 | 쿠폰 유효성 검증 순서: (a)status→(b)userId→(c)expiresAt→(d)minOrderAmount | — | — | `when_validation_order_a_status_used_then_422`, `when_validation_order_b_userId_mismatch_then_403`, `when_validation_order_c_expired_then_422`, `when_validation_order_d_minOrderAmount_then_422` | coupon.service.spec.ts::validation sequence tests | [env:unit] |

### 쿠폰-주문 통합 (SC-012~024)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-012 | 주문 생성 시 userCouponId 전달 → 서버가 discountAmount 계산 | `when_createOrder_with_coupon_then_discountAmount_set_by_server` | — | — | order.service.spec.ts::when_createOrder_with_coupon_then_discountAmount_set | [env:unit] |
| SC-013 | FIXED 쿠폰 적용: discountAmount=min(discountValue,totalAmount) | `when_FIXED_coupon_then_exact_discountAmount` | `when_FIXED_coupon_exceeds_total_then_capped_to_total` | — | coupon.service.spec.ts::when_FIXED_validateAndCalculate_returns_capped | [env:unit] |
| SC-014 | PERCENTAGE 쿠폰 적용: floor(total×rate/100), maxDiscountAmount 캡 | `when_PERCENTAGE_coupon_then_floored_discountAmount` | `when_PERCENTAGE_exceeds_maxDiscountAmount_then_capped` | — | coupon.service.spec.ts::when_PERCENTAGE_validateAndCalculate_returns_floored | [env:unit] |
| SC-015 | 쿠폰 검증 실패 (status=used) → 422 | — | — | `when_validateAndCalculate_status_used_then_422` | coupon.service.spec.ts::when_status_used_then_UnprocessableEntityException | [env:unit] |
| SC-016 | 쿠폰 검증 실패 (userId 불일치) → 403 | — | — | `when_validateAndCalculate_userId_mismatch_then_403` | coupon.service.spec.ts::when_userId_mismatch_then_ForbiddenException | [env:unit] |
| SC-017 | 쿠폰 검증 실패 (만료) → 422 | — | — | `when_validateAndCalculate_expired_then_422` | coupon.service.spec.ts::when_expired_then_UnprocessableEntityException | [env:unit] |
| SC-018 | 쿠폰 검증 실패 (minOrderAmount) → 422 | — | — | `when_validateAndCalculate_belowMinOrder_then_422` | coupon.service.spec.ts::when_below_minOrderAmount_then_UnprocessableEntityException | [env:unit] |
| SC-019 | 주문-쿠폰 원자성: markUsed 호출 확인 (트랜잭션 내) | `when_createOrder_succeeds_then_markUsed_called_in_tx` | — | `when_markUsed_fails_then_order_rolled_back` | order.service.spec.ts::when_createOrder_with_coupon_then_markUsed_called | [env:unit] |
| SC-020 | 이중 사용 방지: markUserCouponUsed count=0 → 409 | — | — | `when_markUserCouponUsed_returns_0_then_409` | coupon.service.spec.ts::when_concurrent_use_then_ConflictException | [env:unit] |
| SC-021 | userCouponId 없으면 discount=0, 쿠폰 미호출 | `when_no_coupon_then_discount_zero_and_coupon_not_called` | — | — | order.service.spec.ts::when_createOrder_without_coupon_then_discountAmount_zero | [env:unit] |
| SC-022 | 결제 금액 = totalAmount - discountAmount | `when_pay_with_coupon_then_charge_net_amount` | — | — | payment.service.spec.ts::when_pay_with_discountAmount_then_gateway_charge_net | [env:unit] |
| SC-023 | 주문 취소 → 쿠폰 복원 (restoreForOrder 호출) | `when_cancel_order_then_restoreForOrder_called` | — | — | order.service.spec.ts::when_cancel_then_restoreForOrder_called | [env:unit] |
| SC-024 | 취소 이미 취소 상태면 쿠폰 복원 불필요 (spec: 취소 시 환불·쿠폰 복원 원자성) | — | — | `when_markUsed_throws_then_createOrder_rejects` | order.service.spec.ts::when_markUsed_throws_ConflictException_then_propagated | [env:unit] |

### 리뷰 CRUD (SC-030~041)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-030 | 리뷰 생성 → DB 저장 + review.created 이벤트 | `when_createReview_then_stored_and_event_emitted` | — | — | review.service.spec.ts::when_createReview_then_stored_and_event_emitted | [env:unit] |
| SC-031 | 리뷰 생성 권한: orderItem null → 404 | — | — | `when_createReview_orderItem_null_then_404` | review.service.spec.ts::when_orderItem_not_found_then_NotFoundException | [env:unit] |
| SC-032 | 리뷰 생성 권한: orderUserId 불일치 → 403 | — | — | `when_createReview_orderUserId_mismatch_then_403` | review.service.spec.ts::when_orderUserId_mismatch_then_ForbiddenException | [env:unit] |
| SC-033 | 리뷰 생성 권한: orderStatus !== completed → 422 | — | — | `when_createReview_orderStatus_not_completed_then_422` | review.service.spec.ts::when_orderStatus_not_completed_then_UnprocessableEntityException | [env:unit] |
| SC-034 | 리뷰 중복 (P2002 unique) → 409 | — | — | `when_createReview_duplicate_then_409` | review.service.spec.ts::when_P2002_then_ConflictException | [env:unit] |
| SC-035 | 리뷰 권한 검증 순서: null→404→403→422→409 | — | — | `when_review_null_then_404_before_403`, `when_review_userId_mismatch_then_403_before_422` | review.service.spec.ts::review permission order tests | [env:unit] |
| SC-036 | 리뷰 수정: 작성자만 가능 | `when_updateReview_by_author_then_ok` | — | `when_updateReview_by_other_then_403` | review.service.spec.ts::when_updateReview_by_author_then_ok | [env:unit] |
| SC-037 | 리뷰 삭제: 작성자만 가능 | `when_deleteReview_by_author_then_ok` | — | `when_deleteReview_by_other_then_403` | review.service.spec.ts::when_deleteReview_by_author_then_ok | [env:unit] |
| SC-038 | 리뷰 삭제: 리뷰 없으면 404 | — | — | `when_deleteReview_not_found_then_404` | review.service.spec.ts::when_review_not_found_for_delete_then_NotFoundException | [env:unit] |
| SC-039 | 상품 리뷰 목록 조회 | `when_listProductReviews_then_returns_list` | — | — | review.service.spec.ts::when_listProductReviews_then_returns_list | [env:unit] |
| SC-040 | 내 리뷰 목록 조회 | `when_listMyReviews_then_returns_list` | — | — | review.service.spec.ts::when_listMyReviews_then_returns_list | [env:unit] |
| SC-041 | review.created 이벤트: 6개 필드 포함 | `when_createReview_then_event_has_6_fields` | — | — | review.service.spec.ts::when_createReview_then_event_payload_complete | [env:unit] |

### NFR 정적 검증 (SC-050~055)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-050 | 쿠폰 금전 필드(discountValue, maxDiscountAmount, minOrderAmount) Decimal 타입 | `when_inspect_coupon_decimal_fields_then_all_Decimal` | — | — | schema-decimal.spec.ts::추가 MONEY_FIELDS | [env:static] |
| SC-051 | coupon.used 이벤트: 5개 필드 포함 | `when_markUsed_then_event_has_5_fields` | — | — | coupon.service.spec.ts::when_markUsed_then_couponUsed_event_emitted_with_5_fields | [env:unit] |
| SC-052 | 쿠폰·리뷰 API: 미인증 → 401 | `when_unauthenticated_then_401` | — | — | auth-required-guards.spec.ts::추가 coupon+review 컨트롤러 | [env:static] |
| SC-053 | 쿠폰 cross-schema: commerce 외 모델 직접 참조 금지 | `when_CouponRepository_accesses_commerce_only` | — | — | cross-schema.spec.ts::추가 CouponRepository 규칙 | [env:static] |
| SC-054 | 리뷰 cross-schema: commerce 외 모델 직접 참조 금지 | `when_ReviewRepository_accesses_commerce_only` | — | — | cross-schema.spec.ts::추가 ReviewRepository 규칙 | [env:static] |
| SC-055 | OrderRepository cross-schema: commerce 신규 모델 추가 | `when_OrderRepository_cannot_access_coupon_review` | — | — | cross-schema.spec.ts::COMMERCE_SCHEMA_MODELS 확장 | [env:static] |

---

## 외부 의존성 명시

### fixture / mock

- `mockCouponRepository`: CouponRepository 전체 메서드 jest.fn()
- `mockCouponEvents`: `{ emitCouponUsed: jest.fn() }`
- `mockReviewRepository`: ReviewRepository 전체 메서드 jest.fn()
- `mockReviewEvents`: `{ emitReviewCreated: jest.fn() }`
- `mockOrderService`: `{ getOrderItemForReview: jest.fn() }` (ReviewService DI)
- `mockCouponService`: `{ validateAndCalculateDiscount: jest.fn(), markUsed: jest.fn(), restoreForOrder: jest.fn() }` (OrderService DI)
- `mockPrismaService`: `{ runInTransaction: jest.fn().mockImplementation((fn)=>fn()), onAfterCommit: jest.fn().mockImplementation((cb)=>Promise.resolve(cb())), get tx(){ return this } }`
- `mockSellerService`: `{ getSellerByUserId: jest.fn() }` (CouponService DI)

### 환경 변수

테스트 실행 시 별도 환경 변수 불필요 (unit test — DB 연결 없음).

### 외부 서비스

DB 연결 없음. 모든 외부 의존성 mock 처리.

---

## 미커버 항목 (사전 분류 — 4-카테고리)

| SC-ID | 미커버 사유 | 카테고리 | 권장 검증 방법 |
|---|---|---|---|
| SC-004 (발급 한도 issuedCount $executeRaw) | $executeRaw raw SQL은 DB 연결 없이 카운트 증분 결과 검증 불가 | (2) 단위테스트 불가 | 통합 테스트 또는 실 DB 검증 |
| SC-006 (incrementIssuedCountConditional count 반환) | DB 동시성 race condition — 실제 동시 요청 환경 재현 불가 | (2) 단위테스트 불가 | 부하 테스트 또는 통합 테스트 |
| SC-020 (동시 사용 409) | 단위 테스트에서는 markUserCouponUsed count=0 시나리오로 검증 (단위 가능). 실제 동시성은 DB 수준 | (1) 단위테스트 가능 | coupon.service.spec.ts에서 mock count=0 반환 시나리오로 검증 |
| SC-019 (트랜잭션 롤백 원자성) | 단위 테스트에서 runInTransaction + throw 시나리오로 검증 가능 (단위 가능). 실제 DB 롤백은 통합 환경 | (1) 단위테스트 가능 | order.service.spec.ts에서 mock throw 시나리오로 검증 |
