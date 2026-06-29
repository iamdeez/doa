---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 15:06
상태: 확정
---

# Coverage: 004-review-coupon

## 실행 요약

| 항목 | 결과 |
|---|---|
| Unit 테스트 (src/) | 172 PASS / 0 FAIL / 16 suites |
| Static 테스트 (test/static/) | 40 PASS / 0 FAIL / 9 suites |
| 합계 | 212 PASS / 0 FAIL / 25 suites |
| 003 회귀 | NONE |

---

## SC × 시나리오 커버리지 매트릭스

### 쿠폰 생성·발급 (SC-001~011)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | plan.md 시나리오 전체 | 상태 |
|---|---|---|---|---|---|---|
| SC-001 | ADMIN FIXED 쿠폰 생성 | when_admin_creates_FIXED_coupon | — | — | ✓ | PASS |
| SC-002 | ADMIN PERCENTAGE 쿠폰 생성 | when_admin_creates_PERCENTAGE_coupon | — | — | ✓ | PASS |
| SC-003 | AdminGuard 비적용 → 403 | — | — | SEC-001 (admin.guard.spec.ts) | △ | INDIRECT |
| SC-004 | SELLER FIXED 쿠폰 생성 issuerType=SELLER | when_approved_seller_creates_coupon | — | — | ✓ | PASS |
| SC-005 | 미승인 SELLER → 403 | — | — | when_non_approved_seller_then_ForbiddenException | ✓ | PASS |
| SC-006 | ADMIN 쿠폰 발급 → UserCoupon 생성 | when_admin_issues_coupon_then_UserCoupon_created | — | — | ✓ | PASS |
| SC-007 | issuedCount > totalQuantity → 409 | — | — | when_issuedCount_exceeds_totalQuantity | ✓ | PASS |
| SC-008 | SELLER 자기 쿠폰 발급 | when_seller_issues_own_coupon_then_success | — | — | ✓ | PASS |
| SC-009 | SELLER/ADMIN 타인 쿠폰 발급 → 403 | — | — | when_seller_issues_others_coupon_then_403, when_admin_issues_others_coupon_then_403 | ✓ | PASS |
| SC-010 | 내 쿠폰 목록 (status 필터) | when_list_my_coupons | when_list_my_coupons_status_filter | — | ✓ | PASS |
| SC-011 | 판매자 쿠폰 목록 (본인 것만) | when_list_seller_coupons | — | — | ✓ | PASS |

### 쿠폰↔주문 연동 (SC-012~024)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | plan.md 시나리오 전체 | 상태 |
|---|---|---|---|---|---|---|
| SC-012 | 유효 쿠폰 → validateAndMarkUsed 호출 | when_userCouponId_provided_then_validate_and_markUsed_called | — | — | ✓ | PASS |
| SC-013 | FIXED 쿠폰 할인 계산 (cap 적용) | when_FIXED_coupon_then_discountAmount_equals_discountValue | when_FIXED_capped_at_totalAmount | — | ✓ | PASS |
| SC-014 | PERCENTAGE 쿠폰 할인 계산 (floor·maxDiscount) | when_PERCENTAGE_coupon_then_floor_applied | when_below_maxDiscount, when_no_maxDiscount | — | ✓ | PASS |
| SC-015 | 만료 쿠폰 → 422 | — | — | when_expired_then_UnprocessableEntityException | ✓ | PASS |
| SC-016 | status=used → 422 | — | — | when_status_used_then_UnprocessableEntityException | ✓ | PASS |
| SC-017 | userId 불일치 → 403 | — | — | when_userId_mismatch_then_ForbiddenException | ✓ | PASS |
| SC-018 | totalAmount < minOrderAmount → 422 | — | — | when_below_minOrderAmount_then_UnprocessableEntityException | ✓ | PASS |
| SC-019 | validate pre-tx → markUsed in-tx 순서 | — | when_coupon_applied_then_validate_called_before_tx | — | ✓ | PASS |
| SC-020 | 조건부 UPDATE 0건 → 409 (이중사용 방지) | — | — | when_markUserCouponUsed_returns_0_then_409, when_markUsed_throws_then_createOrder_rejects | ✓ | PASS |
| SC-021 | 쿠폰 미적용 주문 (validate/markUsed 미호출) | when_no_userCouponId_then_no_validate_markUsed | — | — | ✓ | PASS |
| SC-022 | discountAmount 반영 결제 net charge | when_discount_applied_then_charge_is_net | — | — | ✓ | PASS |
| SC-023 | 주문 취소 → couponService.restoreForOrder 호출 | when_cancel_then_restoreForOrder_called | — | — | ✓ | PASS |
| SC-024 | coupon.used 이벤트 5개 필드 발행 | when_markUsed_succeeds_then_event_emitted_5_fields | — | — | ✓ | PASS |

### 리뷰 CRUD (SC-030~041)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | plan.md 시나리오 전체 | 상태 |
|---|---|---|---|---|---|---|
| SC-030 | POST /reviews → 201 저장 | when_createReview_then_stored_and_returned | — | — | ✓ | PASS |
| SC-031 | Order.status != completed → 422 | — | — | when_orderStatus_not_completed_then_UnprocessableEntityException (*) | ✓ | PASS |
| SC-032 | 타인 주문 orderItemId → 403 | — | — | when_orderUserId_mismatch_then_ForbiddenException | ✓ | PASS |
| SC-033 | 동일 orderItemId 두 번째 리뷰 → 409 | — | — | when_P2002_then_ConflictException (*) | ✓ | PASS |
| SC-034 | rating=0 또는 rating=6 → 400 | — | — | (미테스트) | ✗ | GAP |
| SC-035 | PATCH /reviews/:id 자신 리뷰 수정 | when_updateReview_by_author_then_ok (*) | — | — | ✓ | PASS |
| SC-036 | 타인 리뷰에 PATCH → 403 | — | — | when_updateReview_by_other_then_403 (*) | ✓ | PASS |
| SC-037 | DELETE /reviews/:id 자신 리뷰 삭제 | when_deleteReview_by_author_then_ok (*) | — | — | ✓ | PASS |
| SC-038 | 타인 리뷰에 DELETE → 403 | — | — | when_deleteReview_by_other_then_403 (*) | ✓ | PASS |
| SC-039 | GET /products/:id/reviews → 목록·최신순 | when_listProductReviews_then_returned | — | — | ✓ | PASS |
| SC-040 | GET /reviews/me → 내 리뷰 목록 | when_listMyReviews_then_own_reviews | — | — | ✓ | PASS |
| SC-041 | review.created 이벤트 6개 필드 발행 | when_createReview_then_event_has_6_fields | — | — | ✓ | PASS |

> (*) review.service.spec.ts 의 테스트 SC 레이블이 spec.md SC 번호와 다르게 매핑됨 (test-cases.md AUTHORING 오프셋):
> - spec.md SC-031 → test describe SC-033 (orderStatus != completed → 422)
> - spec.md SC-033 → test describe SC-034 (P2002 → 409)
> - spec.md SC-035 → test describe SC-036 Happy Path
> - spec.md SC-036 → test describe SC-036 Error Path
> - spec.md SC-037 → test describe SC-037 Happy Path
> - spec.md SC-038 → test describe SC-037 Error Path
> 기능적 커버리지는 모두 충족. SC 레이블 정합성은 coverage-gap.md §레이블 불일치 참조.

### NFR 정적 검증 (SC-050~055)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | plan.md 시나리오 전체 | 상태 |
|---|---|---|---|---|---|---|
| SC-050 | coupon 엔티티 Decimal 타입 정적 검증 | when_inspect_discountValue/maxDiscountAmount/minOrderAmount_Decimal | — | — | ✓ | PASS |
| SC-051 | 조건부 UPDATE WHERE status='unused' 정적 grep | when_inspect_coupon_repository_then_conditional_update | — | — | ✓ | PASS |
| SC-052 | coupon·review 컨트롤러 JwtAuthGuard 적용 | when_inspect_auth_controllers_then_jwt_guard_applied | — | — | ✓ | PASS |
| SC-053 | IDOR 시나리오 → 403 (SC-017·SC-032·SC-036·SC-038 포함) | — | — | (개별 SC 단위 테스트로 커버) | ✓ | PASS |
| SC-054 | coupon·review Repository 크로스 스키마 참조 금지 | when_inspect_CouponRepository_SC_053_then_no_cross_schema, when_inspect_ReviewRepository_SC_054_then_no_cross_schema | — | — | ✓ | PASS |
| SC-055 | @aws-sdk/* 패키지 신규 추가 없음 | when_inspect_package_json_then_no_aws_sdk_packages | — | — | ✓ | PASS |

> SC-054 비고: cross-schema.spec.ts 에서 CouponRepository 검사가 describe label "SC-053"으로, ReviewRepository 검사가 "SC-054"로 표기되어 있음. 두 테스트를 합산하여 spec.md SC-054 커버.
> SC-055 비고: package-no-aws.spec.ts 의 describe label 이 "SC-051"로 표기되어 있으나 AWS SDK 검사이므로 spec.md SC-055 커버. coupon-conditional-update.spec.ts 가 spec.md SC-051(조건부 UPDATE) 정확히 커버.

---

## 커버리지 요약

| 항목 | 수 |
|---|---|
| 전체 SC | 41 |
| PASS (직접 커버) | 38 |
| INDIRECT (간접 커버) | 1 (SC-003) |
| GAP | 1 (SC-034) |

---

## STALE_SC 경고

STALE_SC 검출 결과: **0건**

검출 대상: 이번 차수(004) git diff 변경 파일 내 docstring SC 번호 (PATCH-A18 검출 범위 한정 규칙 적용).

모든 테스트 파일에서 사용된 SC 번호(SC-001~055)가 spec.md 에 존재하므로 STALE_SC 경고 없음.

단, 다음 **semantic mismatch** 가 존재함 (STALE_SC 는 아니나 추적 품질 저하):
- `package-no-aws.spec.ts` describe label: "SC-051: @aws-sdk/* 신규 의존 없음" → spec.md SC-051 = 조건부 UPDATE, spec.md SC-055 = AWS SDK
- `cross-schema.spec.ts` label: CouponRepository = "SC-053", OrderRepository = "SC-055" → spec.md SC-053 = IDOR(unit), SC-054 = cross-schema(static), SC-055 = AWS SDK
- `review.service.spec.ts` describe labels SC-031~038 가 spec.md SC-031~038 과 오프셋 차이
