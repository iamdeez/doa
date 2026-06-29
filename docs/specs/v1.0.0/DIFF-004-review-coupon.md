---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-29
상태: 확정
---

# Diff: 004-review-coupon

## 커밋 메시지용 한 줄 요약

(이 섹션은 커밋 메시지 작성 시 참고할 수 있도록 제공한다. 실제 커밋 메시지는 프로젝트 컨벤션에 맞춰 자유롭게 조정한다.)

- **KO**: coupon·review 모듈 실구현 및 order/payment 쿠폰 연동 보정
- **EN**: implement coupon & review modules with order/payment coupon integration

## 변경 요약

- **Prisma 스키마 (commerce 확장)**: CouponIssuerType·CouponType·UserCouponStatus 3개 enum, Coupon·UserCoupon·Review 3개 모델 추가. Decimal(12,2) 금전 필드, 조건부 issuedCount, orderItemId @unique, 복합 cursor 인덱스 정의.
- **coupon 모듈 스텁 → 실구현**: CouponRepository ($executeRaw 조건부 increment, updateMany 이중사용 방지), CouponService (validateAndCalculateDiscount pre-tx / markUsed in-tx / restoreForOrder), AdminCouponController·SellerCouponController·UserCouponController 3-컨트롤러 분리.
- **review 모듈 스텁 → 실구현**: ReviewRepository (commerce 스키마 전용, cursor 페이지네이션), ReviewService (OrderService DI 경유 소유권·completed 검증, P2002→409, review.created 이벤트), ReviewController(인증 필수)·ProductReviewController(공개 열람) 분리.
- **order 모듈 쿠폰 연동**: CreateOrderDto에 userCouponId 추가(SEC-FIND-004 discountAmount 직접 지정 금지), OrderService.createOrder pre-tx 검증 + in-tx markUsed 분기, cancel 쿠폰 복원, getOrderItemForReview 공개 메서드 추가(P-001 DI 경로), OrderRepository.findOrderItemWithOrder 신규.
- **payment 모듈 할인 적용**: pay 청구 금액 totalAmount → totalAmount - discountAmount (FR-015, discountAmount=0 회귀 없음).
- **테스트 추가**: SC-012/019/020/021/023 쿠폰 연동 단위 테스트(order.service.spec), SC-022 net charge 검증(payment.service.spec), SC-052 JWT guard 정적 검증(coupon·review 컨트롤러), SC-053/054 크로스 스키마 금지 정적 검증, SC-050(004) Decimal 타입 정적 검증.

## 변경 파일 및 라인 수

| 파일 | 추가 | 삭제 |
|---|---|---|
| `apps/backend/prisma/schema.prisma` | +108 | -0 |
| `apps/backend/src/modules/coupon/coupon.controller.ts` | +150 | -3 |
| `apps/backend/src/modules/coupon/coupon.events.ts` | +9 | -1 |
| `apps/backend/src/modules/coupon/coupon.module.ts` | +18 | -2 |
| `apps/backend/src/modules/coupon/coupon.repository.ts` | +124 | -1 |
| `apps/backend/src/modules/coupon/coupon.service.ts` | +246 | -2 |
| `apps/backend/src/modules/order/dto/create-order.dto.ts` | +6 | -0 |
| `apps/backend/src/modules/order/order.controller.ts` | +1 | -0 |
| `apps/backend/src/modules/order/order.module.ts` | +2 | -0 |
| `apps/backend/src/modules/order/order.repository.ts` | +13 | -0 |
| `apps/backend/src/modules/order/order.service.spec.ts` | +216 | -2 |
| `apps/backend/src/modules/order/order.service.ts` | +47 | -9 |
| `apps/backend/src/modules/payment/payment.service.spec.ts` | +47 | -1 |
| `apps/backend/src/modules/payment/payment.service.ts` | +2 | -2 |
| `apps/backend/src/modules/review/review.controller.ts` | +94 | -3 |
| `apps/backend/src/modules/review/review.events.ts` | +10 | -1 |
| `apps/backend/src/modules/review/review.module.ts` | +9 | -2 |
| `apps/backend/src/modules/review/review.repository.ts` | +83 | -1 |
| `apps/backend/src/modules/review/review.service.ts` | +116 | -2 |
| `apps/backend/test/static/auth-required-guards.spec.ts` | +22 | -8 |
| `apps/backend/test/static/cross-schema.spec.ts` | +32 | -3 |
| `apps/backend/test/static/schema-decimal.spec.ts` | +13 | -1 |
| `docs/specs/v1.0.0/CHANGES.md` | +55 | -0 |

**합계**: 23 files changed, 1423 insertions(+), 44 deletions(-)


## Diff

> 전체 diff 는 본 문서에 박제하지 않는다 — **git 이 형상관리 SoT** 이며 전체 캡처는 중복·비효율이다.
> 변경 내용은 위 "변경 요약" · "변경 파일 및 라인 수" 절로 추적하고, 라인 단위 diff 가 필요하면 아래로 재생성한다:
>
> ```bash
> git diff c1f1618 (003 완료) -- apps   # base commit: c1f1618 (003 완료)
> ```
