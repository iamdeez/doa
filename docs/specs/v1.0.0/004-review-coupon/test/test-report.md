---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 15:06
상태: 확정
---

# 테스트 실행 결과

## 실행 요약

| 항목 | 결과 |
|---|---|
| 실행 일시 | 2026-06-29 |
| Unit 테스트 (apps/backend, rootDir: src) | **172 PASS** / 0 FAIL / 16 suites |
| Static 테스트 (apps/backend, test/static/) | **40 PASS** / 0 FAIL / 9 suites |
| 합계 | **212 PASS** / 0 FAIL / 25 suites |
| 전체 통과 여부 | PASS |
| 003 회귀 여부 | **없음** |

### Unit 테스트 실행 커맨드

```bash
cd /Users/krystal/workspace/doa/doa-next/apps/backend
npx jest --testPathPattern="src/" --verbose
```

### Static 테스트 실행 커맨드

```bash
cd /Users/krystal/workspace/doa/doa-next/apps/backend
npx jest --config ./test/jest-e2e.json --testPathPattern="test/static" --verbose
```

> Static 테스트는 `package.json` jest 설정(rootDir: "src")으로 실행 불가. 반드시 `test/jest-e2e.json`(rootDir: ".") 으로 실행해야 함.

---

## 실패 목록

**실패 없음.** 212개 테스트 전체 PASS.

---

## SC 미커버 항목

| SC-ID | 미커버 유형 | 근본원인 | 카테고리 |
|---|---|---|---|
| SC-003 | AdminGuard 비적용 → 403 (no labeled unit test) | 테스트 미작성 (controller-level 단위테스트) | (1) 단위테스트 가능 |
| SC-034 | rating=0 or 6 → 400 (DTO validation 미테스트) | 테스트 미작성 (DTO validation 단위테스트) | (1) 단위테스트 가능 |

---

## plan.md 매핑표 검증

**SC 매핑 테이블**:

| SC-ID | 관련 테스트 | 통과 여부 | 미커버 근본원인 |
|---|---|---|---|
| SC-001 | coupon.service.spec.ts: when_admin_creates_FIXED_coupon_then_repository_createCoupon_called | PASS | - |
| SC-002 | coupon.service.spec.ts: when_admin_creates_PERCENTAGE_coupon_then_stored | PASS | - |
| SC-003 | admin.guard.spec.ts: SEC-001 (간접) + coupon.controller.ts @UseGuards 정적 확인 | INDIRECT | 테스트 미작성 (controller SC-003 레이블 단위테스트) |
| SC-004 | coupon.service.spec.ts: when_approved_seller_creates_coupon_then_issuerType_SELLER | PASS | - |
| SC-005 | coupon.service.spec.ts: when_non_approved_seller_creates_coupon_then_ForbiddenException | PASS | - |
| SC-006 | coupon.service.spec.ts: when_admin_issues_coupon_then_UserCoupon_created | PASS | - |
| SC-007 | coupon.service.spec.ts: when_issuedCount_exceeds_totalQuantity_then_ConflictException | PASS | - |
| SC-008 | coupon.service.spec.ts: when_seller_issues_own_coupon_then_success | PASS | - |
| SC-009 | coupon.service.spec.ts: when_seller_issues_others_coupon_then_ForbiddenException, when_admin_issues_others_coupon_then_ForbiddenException | PASS | - |
| SC-010 | coupon.service.spec.ts: when_list_my_coupons_then_returns_own_coupons + filter variant | PASS | - |
| SC-011 | coupon.service.spec.ts: when_list_seller_coupons_then_returns_own_coupons_only | PASS | - |
| SC-012 | order.service.spec.ts: when_userCouponId_provided_then_validate_and_markUsed_called | PASS | - |
| SC-013 | coupon.service.spec.ts: FIXED 할인 계산 (cap 포함) 다수 케이스 | PASS | - |
| SC-014 | coupon.service.spec.ts: PERCENTAGE 할인 계산 (floor·maxDiscount) 다수 케이스 | PASS | - |
| SC-015 | coupon.service.spec.ts: when_coupon_expired_then_UnprocessableEntityException_422 | PASS | - |
| SC-016 | coupon.service.spec.ts: when_status_used_then_UnprocessableEntityException_422 | PASS | - |
| SC-017 | coupon.service.spec.ts: when_userId_mismatch_then_ForbiddenException_403 | PASS | - |
| SC-018 | coupon.service.spec.ts: when_totalAmount_below_minOrderAmount_then_UnprocessableEntityException_422 | PASS | - |
| SC-019 | order.service.spec.ts: when_coupon_applied_then_validate_called_before_tx | PASS | - |
| SC-020 | coupon.service.spec.ts: when_markUserCouponUsed_returns_0_then_ConflictException_409; order.service.spec.ts: when_markUsed_throws_ConflictException_then_createOrder_rejects | PASS | - |
| SC-021 | order.service.spec.ts: when_no_userCouponId_then_validate_and_markUsed_not_called | PASS | - |
| SC-022 | payment.service.spec.ts: when_discount_applied_then_charge_amount_is_net | PASS | - |
| SC-023 | order.service.spec.ts: when_cancel_then_restoreForOrder_called_with_orderId | PASS | - |
| SC-024 | coupon.service.spec.ts: when_markUsed_succeeds_then_couponUsed_event_emitted_with_5_fields | PASS | - |
| SC-030 | review.service.spec.ts: when_createReview_then_stored_and_returned | PASS | - |
| SC-031 | review.service.spec.ts: when_orderStatus_not_completed_then_UnprocessableEntityException (test label: SC-033) | PASS | - |
| SC-032 | review.service.spec.ts: when_orderUserId_mismatch_then_ForbiddenException (test label: SC-032) | PASS | - |
| SC-033 | review.service.spec.ts: when_P2002_then_ConflictException (test label: SC-034) | PASS | - |
| SC-034 | (없음) | - | 테스트 미작성 (rating 0·6 → 400 DTO validation) |
| SC-035 | review.service.spec.ts: when_updateReview_by_author_then_ok (test label: SC-036 Happy) | PASS | - |
| SC-036 | review.service.spec.ts: when_updateReview_by_other_then_403 (test label: SC-036 Error) | PASS | - |
| SC-037 | review.service.spec.ts: when_deleteReview_by_author_then_ok (test label: SC-037 Happy) | PASS | - |
| SC-038 | review.service.spec.ts: when_deleteReview_by_other_then_403 (test label: SC-037 Error) | PASS | - |
| SC-039 | review.service.spec.ts: when_listProductReviews_then_returned | PASS | - |
| SC-040 | review.service.spec.ts: when_listMyReviews_then_own_reviews | PASS | - |
| SC-041 | review.service.spec.ts: when_createReview_then_event_has_6_fields | PASS | - |
| SC-050 | test/static/schema-decimal.spec.ts: Decimal 타입 정적 검증 (discountValue·maxDiscountAmount·minOrderAmount) | PASS | - |
| SC-051 | test/static/coupon-conditional-update.spec.ts: when_inspect_coupon_repository_then_conditional_update; coupon.service.spec.ts: SC-051 markUsed count=0 단언 | PASS | - |
| SC-052 | test/static/auth-required-guards.spec.ts: when_inspect_auth_controllers_then_jwt_guard_applied | PASS | - |
| SC-053 | IDOR 시나리오: SC-017(coupon.service) + SC-032/SC-036/SC-038(review.service) 개별 테스트로 커버 | PASS | - |
| SC-054 | test/static/cross-schema.spec.ts: CouponRepository + ReviewRepository cross-schema 검증 | PASS | - |
| SC-055 | test/static/package-no-aws.spec.ts: when_inspect_package_json_then_no_aws_sdk_packages | PASS | - |

---

## 설계 문서 정합성

### plan.md 현행화 점검

- 쿠폰 할인 계산 로직: plan.md 의 `Decimal` 기반 계산, floor 적용, cap 조건이 구현과 일치 ✓
- 조건부 UPDATE: `updateMany + where: { status: UserCouponStatus.unused }` 패턴 정적 검증 PASS ✓
- coupon.used / review.created 이벤트 필드 수: plan.md 정의(5개/6개)와 테스트 단언 일치 ✓
- cross-schema 금지: COMMERCE_SCHEMA_MODELS에 coupon·userCoupon·review 추가 반영 ✓

### 발견된 불일치: test-cases.md SC 레이블 오프셋

test-cases.md (AUTHORING 산출물) 와 spec.md 간 review 섹션 SC 번호 매핑 오프셋:

| spec.md SC | test-cases.md SC | 시나리오 |
|---|---|---|
| SC-031 (status != completed → 422) | SC-033 | orderStatus 검증 |
| SC-032 (타인 주문 → 403) | SC-032 | userId 불일치 |
| SC-033 (중복 리뷰 → 409) | SC-034 | P2002 UniqueConstraint |
| SC-034 (rating 0 or 6 → 400) | (누락) | DTO validation — **GAP** |
| SC-035 (PATCH 자신) | SC-036 Happy | updateReview author |
| SC-036 (타인 PATCH → 403) | SC-036 Error | updateReview other |
| SC-037 (DELETE 자신) | SC-037 Happy | deleteReview author |
| SC-038 (타인 DELETE → 403) | SC-037 Error | deleteReview other |

기능 커버리지는 모두 충족되나, SC-034 (rating validation → 400) 가 test-cases.md 와 review.service.spec.ts 양쪽에서 누락됨.

또한 static 테스트 파일의 SC 레이블 semantic mismatch:
- `package-no-aws.spec.ts` describe: "SC-051: @aws-sdk/* 의존 없음" → spec.md SC-051 = 조건부 UPDATE, SC-055 = AWS SDK 미추가
- `cross-schema.spec.ts` describe: CouponRepository label "SC-053" → spec.md SC-053 = IDOR(unit), SC-054 = cross-schema(static)

이 불일치들은 산출물 정합성 저하이나 기능 커버리지에 영향 없음. 코드 수정 불필요 (레이블 정정만 권장).

### 003 회귀 확인

- order.service.spec.ts: 003 SC-009~032 그룹 전체 PASS. CouponService mock provider 추가 후 기존 테스트 영향 없음.
- payment.service.spec.ts: 003 SC 전체 PASS. discountAmount net charge 테스트(004 SC-022) 추가 영향 없음.
- 기타 003 모듈(cart, product, user, seller 등): 모든 기존 테스트 PASS.

---

## 회귀 탐지

이전 003-commerce 실행 대비 변경사항:
- order.service.spec.ts: CouponService mock 추가(T041 004 spec) + 004 SC(SC-012/019/020/021/023) 테스트 추가
- payment.service.spec.ts: SC-022 discountAmount net charge 테스트 추가
- coupon.service.spec.ts: 신규 파일 (004 산출물)
- review.service.spec.ts: 신규 파일 (004 산출물)
- test/static/: coupon-conditional-update.spec.ts · cross-schema.spec.ts 확장 · schema-decimal.spec.ts 확장 · auth-required-guards.spec.ts 확장

003 기존 테스트 회귀: **0건**
