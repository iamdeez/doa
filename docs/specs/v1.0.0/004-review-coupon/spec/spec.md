---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-29
상태: 확정
---

# Spec: 004-review-coupon

> Branch: 004-review-coupon | Date: 2026-06-29 | Version: v1.0.0

## 목차

- [배경 및 목적](#배경-및-목적)
- [선행 spec 영향 추적](#선행-spec-영향-추적)
- [사용자 스토리](#사용자-스토리)
- [기능 요구사항](#기능-요구사항)
- [비기능 요구사항](#비기능-요구사항)
- [수용 기준](#수용-기준)
- [요구사항 구조화 매트릭스](#요구사항-구조화-매트릭스)
- [PATCH-001 권한 평가 결과](#patch-001-권한-평가-결과)
- [범위 외](#범위-외)
- [미결 사항](#미결-사항)

---

## 배경 및 목적

003-commerce(장바구니·주문·결제) 완료 이후, 오픈마켓의 핵심 부가 도메인 2개를 구현한다.

**쿠폰(Coupon)**
- 관리자·APPROVED 판매자가 고객에게 할인 쿠폰을 발급하고, 고객이 주문 시 적용하여 할인을 받는 마케팅 도구다.
- 003-commerce에서 `OrderService.createOrder`가 `discountAmount = Decimal(0)` 고정으로 처리한 쿠폰 연동 공백을 채운다.
- **SEC-FIND-004 재발 방지**: 클라이언트가 `discountAmount`를 직접 지정하는 경로는 허용하지 않는다. 서버가 쿠폰 유효성을 검증하고 할인 금액을 계산하여 `order.discountAmount`를 설정한다.
- commerce 스키마에 `coupons`·`user_coupons` 테이블을 추가한다(현재 네임스페이스만 선언, 테이블 미생성).

**리뷰(Review)**
- 실구매자가 상품에 대해 평점(1~5)과 의견을 남겨 구매 신뢰 지표를 제공한다.
- 구매 완료(`completed`) 주문의 주문항목(`order_items`) 단위로만 작성 가능하다(허위 리뷰 방지).
- commerce 스키마에 `reviews` 테이블을 추가한다.

---

## 선행 spec 영향 추적

| 선행 spec | 식별된 결함 항목 | 결함 인지 시점 | 식별 경로 |
|---|---|---|---|
| v1.0.0/003-commerce | SEC-FIND-004: `POST /orders`의 `CreateOrderDto`에 `discountAmount` 필드가 없어야 함 — 003-commerce 구현 시 올바르게 제거되어 `Decimal(0)` 고정. 본 spec에서 쿠폰 연동으로 서버측 계산 경로를 추가(클라이언트 금액 임의 지정 금지 원칙 유지). | 2026-06-28 | 003-commerce Planning Agent 보안 분석 |

---

## 사용자 스토리

- **US-001**: 관리자·APPROVED 판매자로서, 고객에게 할인 쿠폰을 생성하고 발급하고 싶다.
- **US-002**: 인증된 고객으로서, 내가 보유한 쿠폰 목록을 조회하고 주문 시 적용하여 할인을 받고 싶다.
- **US-003**: 인증된 고객으로서, 쿠폰이 적용된 주문을 취소했을 때 쿠폰이 복원되기를 원한다.
- **US-004**: 구매 완료한 고객으로서, 구매한 상품의 주문항목에 대해 평점과 리뷰를 작성하고 싶다.
- **US-005**: 인증된 고객으로서, 내가 작성한 리뷰를 수정하거나 삭제하고 싶다.
- **US-006**: 고객·방문자로서, 상품의 리뷰 목록과 평점을 조회하고 싶다.

---

## 기능 요구사항

### 쿠폰 생성 (Coupon Creation)

- **FR-001**: 관리자는 `POST /admin/coupons` 로 쿠폰을 생성할 수 있다. 요청 본문에 `type(FIXED|PERCENTAGE)`, `discountValue(양수 Decimal)`, `expiresAt(DateTime)`, `description(String?)`, `minOrderAmount(Decimal?)`, `maxDiscountAmount(Decimal? — PERCENTAGE 전용)`, `totalQuantity(Int? — null이면 무제한)`를 포함한다. 본 엔드포인트는 AdminGuard가 적용된다.

  > PERCENTAGE 타입의 `discountValue`는 1 이상 100 이하의 양수여야 한다.

- **FR-002**: APPROVED 판매자는 `POST /sellers/me/coupons` 로 쿠폰을 생성할 수 있다. `issuerType=SELLER`, `issuerId=요청자 sellerId`는 서버에서 자동으로 설정된다. APPROVED 상태가 아닌 판매자 요청은 HTTP 403을 반환한다.

### 쿠폰 발급 (Coupon Issuance)

- **FR-003**: 관리자는 `POST /admin/coupons/:couponId/issue` 로 특정 고객(`userId`)에게 `user_coupon`(status=unused)을 발급할 수 있다. `totalQuantity` 제한이 있는 쿠폰에서 발급 수량이 이미 한도에 도달한 경우 HTTP 409를 반환한다.

- **FR-004**: APPROVED 판매자는 `POST /sellers/me/coupons/:couponId/issue` 로 자신이 생성한 쿠폰을 특정 고객에게 발급할 수 있다. 쿠폰의 `issuerId`가 요청자의 `sellerId`와 다르면 HTTP 403을 반환한다.

### 쿠폰 조회

- **FR-005**: 인증된 고객은 `GET /users/me/coupons` 로 자신이 보유한 `user_coupon` 목록을 조회할 수 있다. `status` 쿼리 파라미터(unused|used|expired|all)로 필터링할 수 있다. 기본값은 unused.

- **FR-006**: APPROVED 판매자는 `GET /sellers/me/coupons` 로 자신이 생성한 쿠폰 목록을 조회할 수 있다. cursor 기반 페이지네이션(`after`, `limit`) 적용.

### 쿠폰↔주문 연동 (Coupon Integration with Order)

- **FR-010**: 주문 생성 요청(`POST /orders`)에 선택적으로 `userCouponId`를 포함할 수 있다. 포함 시 서버가 해당 user_coupon의 유효성을 검증하고 할인 금액을 계산하여 `order.discountAmount`를 설정한다. 클라이언트가 `discountAmount`를 직접 지정하는 방식은 허용하지 않는다(SEC-FIND-004 재발 방지).

- **FR-011**: 쿠폰 유효성 검증 조건(모두 충족해야 함):
  - (a) `user_coupon.status = unused`가 아니면 HTTP 422 반환.
  - (b) `user_coupon.userId ≠ 요청자 userId`이면 HTTP 403 반환.
  - (c) `coupon.expiresAt ≤ 현재 시각`이면(만료) HTTP 422 반환.
  - (d) `coupon.minOrderAmount`가 설정되어 있고 주문 `totalAmount < coupon.minOrderAmount`이면 HTTP 422 반환.

- **FR-012**: 쿠폰 유형별 할인 계산 규칙:
  - FIXED: `discountAmount = MIN(coupon.discountValue, totalAmount)` — 주문 금액 초과 방지.
  - PERCENTAGE: `discountAmount = MIN(FLOOR(totalAmount × coupon.discountValue / 100), coupon.maxDiscountAmount가 있으면 maxDiscountAmount, 없으면 무제한, totalAmount)` — 소수점은 내림(FLOOR) 적용, 주문 금액 초과 방지.
  - 최종: `discountAmount ≤ totalAmount` 항상 보장 (`totalAmount - discountAmount ≥ 0`).

- **FR-013**: 쿠폰 사용 처리는 주문 생성과 동일 Prisma 트랜잭션 내에서 원자적으로 처리된다. 조건부 UPDATE(`WHERE status='unused'`)로 `user_coupon.status=used`, `user_coupon.usedOrderId=orderId`로 갱신한다. 조건 불일치(이중사용 시도) 시 HTTP 409를 반환하고 주문 생성 트랜잭션을 롤백한다.

- **FR-014**: `userCouponId` 없이 주문 생성 시 `discountAmount = 0`으로 유지된다(003-commerce FR-017 기존 동작 유지).

- **FR-015**: 결제 처리(`POST /payments`) 시 실제 청구 금액은 `order.totalAmount - order.discountAmount`로 산출된다. `PaymentGatewayPort`에 전달되는 금액은 이 값을 사용한다. `payment.amount`는 이 청구 금액으로 기록된다.

- **FR-016**: 주문이 `cancelled` 상태로 전이될 때, 해당 주문에 쿠폰이 적용되어 있었다면(`usedOrderId = orderId`인 `user_coupon`이 존재) `user_coupon.status`를 `unused`로 복원하고 `user_coupon.usedOrderId`를 null로 초기화한다. 이 처리는 주문 취소와 동일 트랜잭션 내에서 원자적으로 처리된다.

- **FR-017**: 쿠폰이 성공적으로 사용되면(주문 생성 트랜잭션 완료 후) `coupon.used` 도메인 이벤트를 발행한다(인-프로세스 EventEmitter). 이벤트 payload: `{userCouponId, couponId, orderId, userId, discountAmount}`.

### 리뷰 작성 (Review Create)

- **FR-020**: 인증된 고객은 `POST /reviews` 로 리뷰를 작성할 수 있다. 요청 본문에 `orderItemId`, `rating(1~5 정수)`, `content(String)`를 포함한다.

- **FR-021**: 리뷰 작성 권한 검증(모두 충족해야 함):
  - (a) `orderItemId`에 해당하는 `OrderItem`의 `orderId`로 `Order`를 조회한다. `Order.userId ≠ 요청자 userId`이면 HTTP 403 반환.
  - (b) `Order.status ≠ completed`이면 HTTP 422 반환(구매 완료 주문만 리뷰 허용).
  - (c) 동일 `orderItemId`로 이미 리뷰가 존재하면 HTTP 409 반환.

- **FR-022**: `rating`은 1 이상 5 이하의 정수여야 한다. 범위를 벗어난 값이면 HTTP 400을 반환한다.

### 리뷰 수정·삭제 (Review Modify/Delete)

- **FR-023**: 인증된 고객은 `PATCH /reviews/:id` 로 자신의 리뷰의 `rating`과 `content`를 수정할 수 있다. `review.userId ≠ 요청자 userId`이면 HTTP 403을 반환한다.

- **FR-024**: 인증된 고객은 `DELETE /reviews/:id` 로 자신의 리뷰를 삭제할 수 있다(HTTP 204). `review.userId ≠ 요청자 userId`이면 HTTP 403을 반환한다.

### 리뷰 조회 (Review Query)

- **FR-025**: `GET /products/:productId/reviews` 로 특정 상품의 리뷰 목록을 조회할 수 있다. 인증 불필요(공개). cursor 기반 페이지네이션(`after`, `limit`) 적용. 최신순 정렬.

- **FR-026**: 인증된 고객은 `GET /reviews/me` 로 자신이 작성한 리뷰 목록을 조회할 수 있다. cursor 기반 페이지네이션 적용.

- **FR-027**: 리뷰가 성공적으로 작성되면 `review.created` 도메인 이벤트를 발행한다(인-프로세스 EventEmitter). 이벤트 payload: `{reviewId, orderItemId, orderId, productId, userId, rating}`.

---

## 비기능 요구사항

- **NFR-001**: `coupons.discountValue`, `coupons.maxDiscountAmount`, `coupons.minOrderAmount`, `orders.discountAmount` 등 금전 관련 모든 수치는 Prisma `Decimal` 타입(원 단위)으로 선언한다. 부동소수점(`Float`) 사용을 금지한다(P-005). PERCENTAGE 할인 계산 시 중간 과정에서도 부동소수점 연산을 하지 않는다.

- **NFR-002**: `user_coupon` 사용 처리는 조건부 UPDATE(`WHERE status='unused'`)로 원자적 이중사용을 방지한다. 동시 요청에서 한 건만 성공하고 나머지는 거부되어야 한다(P-005 준용).

- **NFR-003**: 인증이 필요한 모든 엔드포인트는 유효하지 않거나 없는 JWT 토큰으로 요청 시 HTTP 401을 반환한다.

- **NFR-004**: 쿠폰 사용(`userCouponId`)·리뷰 작성·수정·삭제 엔드포인트는 자원 소유권(`user_coupon.userId`, `review.userId`, `order.userId`)을 서버에서 검증하여 IDOR를 차단한다. 상세는 [PATCH-001 권한 평가 결과](#patch-001-권한-평가-결과) 참조.

- **NFR-005**: `coupon`·`review` 모듈의 Repository는 자신의 스키마(`commerce`)에만 Prisma Client로 직접 접근한다. 타 도메인 스키마(`orders`·`users`·`products`) 테이블에 대한 직접 쿼리는 금지된다(P-001). 타 도메인 데이터는 DI를 통한 서비스 메서드 호출로만 접근한다.

- **NFR-006**: AWS 전용 SDK(`@aws-sdk/*`) 또는 서비스를 신규 의존으로 추가하지 않는다(P-002, P-004).

---

## 수용 기준

> **환경 태그 규약**:
> | 태그 | 의미 |
> |---|---|
> | `[env:static]` | 코드·설정 파일 존재·구조 검증만으로 판정 가능 |
> | `[env:unit]` | 단위 테스트로 판정 가능 |
> | `[env:integration]` | 앱 기동(DB/LLM 목·스텁)으로 판정 가능 |

### 쿠폰 생성·발급 SC

- **SC-001** (`FR-001` 관련): 관리자가 `POST /admin/coupons` `{type:'FIXED', discountValue:5000, expiresAt:'2027-01-01', description:'신년쿠폰'}` 호출 시 201과 함께 쿠폰이 생성된다. [env:unit]

- **SC-002** (`FR-001` 관련): PERCENTAGE 쿠폰 `{type:'PERCENTAGE', discountValue:20, maxDiscountAmount:10000, minOrderAmount:30000, expiresAt:'2027-01-01'}` 생성 시 201이 반환된다. [env:unit]

- **SC-003** (`FR-001` 관련): AdminGuard가 적용되지 않은 사용자(일반 고객·APPROVED 판매자)가 `POST /admin/coupons` 호출 시 403이 반환된다. [env:unit]

- **SC-004** (`FR-002` 관련): APPROVED 판매자가 `POST /sellers/me/coupons` 호출 시 201과 함께 쿠폰(`issuerType=SELLER`, `issuerId=sellerId`)이 생성된다. [env:unit]

- **SC-005** (`FR-002` 관련): APPROVED 상태가 아닌 판매자(PENDING·REJECTED) 또는 일반 고객이 `POST /sellers/me/coupons` 호출 시 403이 반환된다. [env:unit]

- **SC-006** (`FR-003` 관련): 관리자가 `POST /admin/coupons/:couponId/issue` `{userId}` 호출 시 201과 함께 `user_coupon`(status=unused)이 생성된다. [env:unit]

- **SC-007** (`FR-003` 관련): `totalQuantity=2`로 생성된 쿠폰에 3번째 발급 시도 시 409가 반환된다. [env:unit]

- **SC-008** (`FR-004` 관련): APPROVED 판매자 A가 자신이 생성한(`issuerId=A.sellerId`) 쿠폰으로 `POST /sellers/me/coupons/:couponId/issue` `{userId}` 호출 시 201이 반환된다. [env:unit]

- **SC-009** (`FR-004` 관련): APPROVED 판매자 A가 다른 발급자(관리자 또는 판매자 B)의 쿠폰으로 발급 시도 시 403이 반환된다. [env:unit]

- **SC-010** (`FR-005` 관련): 인증된 고객이 `GET /users/me/coupons` 호출 시 자신의 `user_coupon` 목록이 반환된다. 다른 고객의 쿠폰은 포함되지 않는다. [env:unit]

- **SC-011** (`FR-006` 관련): APPROVED 판매자가 `GET /sellers/me/coupons` 호출 시 자신이 생성한 쿠폰 목록이 반환된다. 타인이 생성한 쿠폰은 포함되지 않는다. [env:unit]

### 쿠폰↔주문 연동 SC

- **SC-012** (`FR-010`, `FR-012` 관련): 유효한 FIXED 쿠폰(discountValue=5000)을 포함하여 주문 생성(`totalAmount=60000`) 시 `order.discountAmount=5000`이 서버에서 설정된다. 클라이언트가 다른 `discountAmount` 값을 전달해도 서버 계산 결과만 반영된다. [env:unit]

- **SC-013** (`FR-012` 관련): FIXED 쿠폰(discountValue=5000)을 `totalAmount=3000` 주문에 적용 시 `discountAmount=3000`(totalAmount 초과 방지). [env:unit]

- **SC-014** (`FR-012` 관련): PERCENTAGE 쿠폰(discountValue=20, maxDiscountAmount=10000)을 `totalAmount=60000` 주문에 적용 시 `discountAmount=10000`(상한 적용). 동일 쿠폰을 `totalAmount=30000` 주문에 적용 시 `discountAmount=6000`(20% 계산, 상한 미적용). [env:unit]

- **SC-015** (`FR-011` 관련): 만료된 쿠폰(`expiresAt` 경과)으로 주문 생성 시도 시 422가 반환된다. [env:unit]

- **SC-016** (`FR-011` 관련): `status=used`인 `user_coupon`으로 주문 생성 시도 시 422가 반환된다. [env:unit]

- **SC-017** (`FR-011` 관련): 타인의 `userCouponId`(user_coupon.userId ≠ 요청자 userId)로 주문 생성 시도 시 403이 반환된다. [env:unit]

- **SC-018** (`FR-011` 관련): `minOrderAmount=30000`인 쿠폰을 `totalAmount=20000` 주문에 적용 시도 시 422가 반환된다. [env:unit]

- **SC-019** (`FR-013` 관련): 유효한 쿠폰 적용 주문 생성 성공 시 `user_coupon.status=used`, `user_coupon.usedOrderId=orderId`로 갱신된다. 이 처리는 주문 레코드 생성과 동일 트랜잭션 내에서 처리된다. 주문 생성 실패 시 `user_coupon.status`는 `unused`로 유지된다. [env:unit]

- **SC-020** (`FR-013` 관련): 동일 `user_coupon`에 동시 주문 생성 요청이 2건 발생할 때 1건만 성공하고 나머지는 409가 반환된다(이중사용 방지). [env:unit]

- **SC-021** (`FR-014` 관련): `userCouponId` 없이 주문 생성 시 `order.discountAmount=0`이다(기존 003-commerce 동작 유지). [env:unit]

- **SC-022** (`FR-015` 관련): 쿠폰 적용 주문(`totalAmount=60000`, `discountAmount=10000`)에 대해 `POST /payments` 호출 시 `payment.amount=50000`으로 생성된다. [env:unit]

- **SC-023** (`FR-016` 관련): 쿠폰이 적용된 `pending` 상태 주문을 취소(`DELETE /orders/:id`) 시 `user_coupon.status=unused`로 복원되고 `usedOrderId=null`이 된다. [env:unit]

- **SC-024** (`FR-017` 관련): 쿠폰 사용 성공 후 `coupon.used` 이벤트(payload: userCouponId·couponId·orderId·userId·discountAmount)가 발행된다. [env:unit]

### 리뷰 SC

- **SC-030** (`FR-020` 관련): 구매 완료(completed) 주문의 `orderItemId`로 `POST /reviews` `{orderItemId, rating:5, content:'좋아요'}` 호출 시 201과 함께 리뷰가 생성된다. [env:unit]

- **SC-031** (`FR-021` 관련): `Order.status=completed`가 아닌 주문(pending·confirmed·preparing·shipped·delivered)의 `orderItemId`로 리뷰 작성 시도 시 422가 반환된다. [env:unit]

- **SC-032** (`FR-021` 관련): 타인의 주문에 속한 `orderItemId`로 리뷰 작성 시도 시 403이 반환된다. [env:unit]

- **SC-033** (`FR-021` 관련): 동일 `orderItemId`로 두 번째 리뷰 작성 시도 시 409가 반환된다(1 orderItem 1 리뷰 제한). [env:unit]

- **SC-034** (`FR-022` 관련): `rating=0` 또는 `rating=6`으로 리뷰 작성 시도 시 400이 반환된다. [env:unit]

- **SC-035** (`FR-023` 관련): 인증된 고객이 `PATCH /reviews/:id` `{rating:4, content:'수정됨'}` 호출 시 자신의 리뷰가 수정된다. [env:unit]

- **SC-036** (`FR-023` 관련): 타인의 리뷰에 `PATCH /reviews/:id` 시도 시 403이 반환된다. [env:unit]

- **SC-037** (`FR-024` 관련): 인증된 고객이 `DELETE /reviews/:id` 호출 시 자신의 리뷰가 삭제되고 204가 반환된다. [env:unit]

- **SC-038** (`FR-024` 관련): 타인의 리뷰에 `DELETE /reviews/:id` 시도 시 403이 반환된다. [env:unit]

- **SC-039** (`FR-025` 관련): `GET /products/:productId/reviews?limit=10` 호출 시 해당 상품의 리뷰 목록이 최신순 cursor 페이지네이션으로 반환된다. JWT 없이도 접근 가능하다(공개 조회). [env:unit]

- **SC-040** (`FR-026` 관련): 인증된 고객이 `GET /reviews/me?limit=10` 호출 시 자신의 리뷰 목록이 반환된다. 타인의 리뷰는 포함되지 않는다. [env:unit]

- **SC-041** (`FR-027` 관련): 리뷰 생성 성공 후 `review.created` 이벤트(payload: reviewId·orderItemId·orderId·productId·userId·rating)가 발행된다. [env:unit]

### 비기능 SC

- **SC-050** (`NFR-001` 관련): `schema.prisma`의 `coupons` 모델의 `discountValue`, `maxDiscountAmount`, `minOrderAmount` 필드와 `orders` 모델의 `discountAmount` 필드가 모두 `Decimal` 타입으로 선언된다. `Float` 타입으로 선언된 금전 필드가 없다. [env:static]

- **SC-051** (`NFR-002` 관련): `user_coupon` 상태 갱신 시 `WHERE status='unused'` 조건이 포함된 조건부 UPDATE 구문이 사용된다(grep 정적 검사 또는 단위 테스트). [env:unit]

- **SC-052** (`NFR-003` 관련): JWT 없이 쿠폰 발급·리뷰 작성 등 인증 필요 엔드포인트에 접근 시 401이 반환된다. [env:unit]

- **SC-053** (`NFR-004` 관련): 타인의 `userCouponId`로 주문 생성 시도, 타인의 리뷰 수정·삭제 시도 등 IDOR 시나리오에서 403이 반환된다(SC-017, SC-032, SC-036, SC-038 포함). [env:unit]

- **SC-054** (`NFR-005` 관련): `coupon`·`review` 모듈의 Repository 구현 파일에서 자신의 스키마(`commerce`) 외 타 도메인의 Prisma 모델(`orders.Order`, `users.User`, `products.Product` 등)을 직접 참조하는 코드가 없다(grep 정적 검사). [env:static]

- **SC-055** (`NFR-006` 관련): `apps/backend/package.json`의 `dependencies` 및 `devDependencies`에 `@aws-sdk/*` 패키지가 신규 추가되지 않는다. [env:static]

---

## 요구사항 구조화 매트릭스

> 매핑 누락(SC 없는 FR/NFR, FR/NFR 없는 SC) 0건이 완료 조건.
> MoSCoW: Must / Should / Could / Won't

| US-ID | FR-ID | NFR-ID | SC-ID | [env:*] | MoSCoW |
|---|---|---|---|---|---|
| US-001 | FR-001 | — | SC-001, SC-002, SC-003 | unit | Must |
| US-001 | FR-002 | — | SC-004, SC-005 | unit | Must |
| US-001 | FR-003 | — | SC-006, SC-007 | unit | Must |
| US-001 | FR-004 | — | SC-008, SC-009 | unit | Must |
| US-002 | FR-005 | NFR-003 | SC-010, SC-052 | unit | Must |
| US-001 | FR-006 | NFR-003 | SC-011 | unit | Should |
| US-002 | FR-010 | NFR-004 | SC-012, SC-021 | unit | Must |
| US-002 | FR-011 | NFR-004 | SC-015, SC-016, SC-017, SC-018 | unit | Must |
| US-002 | FR-012 | NFR-001 | SC-013, SC-014 | unit | Must |
| US-002 | FR-013 | NFR-002 | SC-019, SC-020 | unit | Must |
| US-002 | FR-014 | — | SC-021 | unit | Must |
| US-002 | FR-015 | NFR-001 | SC-022 | unit | Must |
| US-003 | FR-016 | — | SC-023 | unit | Must |
| US-002 | FR-017 | — | SC-024 | unit | Should |
| US-004 | FR-020 | NFR-003 | SC-030, SC-052 | unit | Must |
| US-004 | FR-021 | NFR-004 | SC-031, SC-032, SC-033 | unit | Must |
| US-004 | FR-022 | — | SC-034 | unit | Must |
| US-005 | FR-023 | NFR-004 | SC-035, SC-036 | unit | Must |
| US-005 | FR-024 | NFR-004 | SC-037, SC-038 | unit | Must |
| US-006 | FR-025 | — | SC-039 | unit | Must |
| US-006 | FR-026 | NFR-003 | SC-040 | unit | Must |
| US-004 | FR-027 | — | SC-041 | unit | Should |
| — | — | NFR-001 | SC-050 | static | Must |
| — | — | NFR-002 | SC-051 | unit | Must |
| — | — | NFR-003 | SC-052 | unit | Must |
| — | — | NFR-004 | SC-053 | unit | Must |
| — | — | NFR-005 | SC-054 | static | Must |
| — | — | NFR-006 | SC-055 | static | Must |

---

## PATCH-001 권한 평가 결과

> 쿠폰 발급·사용 및 리뷰 CRUD 엔드포인트에 대해 인가 3축(호출자 신원·자원 소유권·역할) 평가.

| 엔드포인트 | 위험도 | 완화책 | 대응 SC |
|---|---|---|---|
| `POST /admin/coupons` | 중간 | AdminGuard(`ADMIN_USER_IDS` env, fail-closed) 적용 | SC-003 |
| `POST /sellers/me/coupons` | 낮음 | JwtAuthGuard + APPROVED 판매자 검증 | SC-005 |
| `POST /admin/coupons/:couponId/issue` | 중간 | AdminGuard 적용 | SC-003 |
| `POST /sellers/me/coupons/:couponId/issue` | 중간 | `coupon.issuerId = 요청자 sellerId` 서버 검증 | SC-009 |
| `POST /orders` (userCouponId 포함) | 높음 | `user_coupon.userId = 요청자 userId` 서버 검증, 클라이언트 discountAmount 지정 불가(SEC-FIND-004) | SC-017 |
| `POST /reviews` | 중간 | `orderItem → order.userId = 요청자 userId` 검증 + `order.status = completed` 검증 | SC-031, SC-032 |
| `PATCH /reviews/:id` | 중간 | `review.userId = 요청자 userId` 서버 검증 | SC-036 |
| `DELETE /reviews/:id` | 중간 | `review.userId = 요청자 userId` 서버 검증 | SC-038 |

**잠재 위험 기록 (허용·기록):**
- 판매자 자기 쿠폰 자가 사용: 판매자가 오픈마켓 내에서 고객으로서 쇼핑 시 자신이 발급한 쿠폰을 자신에게 발급·사용 가능. 판매자 할인 비용이므로 사업적 위험이지 보안 위험은 아님. 허용하되 기록.
- 판매자 자기 상품 리뷰 작성: 판매자가 자신의 상품을 구매 후 리뷰 작성 가능. 평점 조작 위험 존재. 본 spec에서는 허용하되, 향후 `order_items.sellerId ≠ review.userId` 조건 추가를 별도 정책 spec으로 처리.

---

## 범위 외

- **배송비 쿠폰**: shipping 모듈 미구현으로 후속 spec 위임.
- **공용 쿠폰 코드 방식**: 특정 코드를 누구나 입력하는 방식 — 본 spec은 개인 발급(user_coupons) 방식만 지원.
- **쿠폰 비활성화·수정·삭제 엔드포인트**: 관리자·판매자 쿠폰 비활성화 — 후속 spec.
- **복수 쿠폰 중복 사용**: 1주문 1쿠폰만 지원.
- **쿠폰 발급 이력 조회**: 관리자·판매자가 발급 내역을 조회하는 엔드포인트 — 후속 spec.
- **배송(Shipping)·정산(Settlement)·검색(Search)·알림(Notification)·파일(File)·배너(Banner)·통계(Stats)·어드민(Admin) 모듈**: Stage 3+ 후속 spec.
- **리뷰 이미지 첨부**: file 모듈 구현 이후 별도 spec.
- **판매자 리뷰 답글**: 후속 spec.
- **리뷰 신고·숨김**: 후속 spec.
- **부분 환불 시 쿠폰 처리**: 본 spec은 전액 취소(쿠폰 전액 복원)만 지원.

### 사후 운영 검증 피드백 사이클

본 spec 파이프라인 종료 후 운영 환경에서 점검할 시나리오:

1. **쿠폰 이중사용 방지 시나리오**: 동일 user_coupon으로 동시 주문 2건 요청 — 1건만 성공하고 1건은 409 반환 확인.
2. **쿠폰 복원 시나리오**: 쿠폰 적용 주문 생성 후 취소 → user_coupon.status=unused 복원 → 동일 쿠폰으로 재주문 성공 확인.
3. **결제 금액 정확성**: discountAmount>0 주문의 payment.amount = totalAmount-discountAmount 확인.
4. **리뷰 중복 방지**: 동일 orderItemId로 리뷰 2건 시도 시 409 확인.

결함 발견 시 처리 절차: 결함 정보를 본 spec.md 배경 및 목적 절에 반영하거나 별도 hotfix spec 입력 → main session의 "spec 수정" 이벤트 → 1단계 재진입 또는 별도 patch spec.

---

## 미결 사항

없음 — 모든 항목이 사용자 확인 완료.
