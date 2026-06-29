---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 확정
---

# Spec: 003-commerce

> Branch: 003-commerce | Date: 2026-06-28 | Version: v1.0.0

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

002-catalog(카탈로그 관리 — 상품·재고) 완료 이후 Stage 2 거래 플로우를 구현한다. 현재 commerce·orders·payments 스키마는 선언만 존재하며 테이블이 없다. 고객이 장바구니에 상품을 담고 주문을 생성하여 결제까지 완료하는 E2E 흐름을 제공한다.

주요 해결 문제:
- 고객 장바구니 관리(JSONB 구조, 사용자당 1건)
- 장바구니 일부 선택 → 주문 생성 → 결제의 원자적 처리
- 결제 신뢰성(outbox 패턴 + idempotency key, P-005)
- 주문 상태 기계(pending → confirmed → preparing → shipped → delivered → completed; 취소 경로 포함)
- 판매자의 주문 처리 흐름(확인·배송 전환)
- 배송완료 후 7일 자동 구매 확정(pg-boss 스케줄)
- SEC-002 수정: 002-catalog 보안 감사에서 식별된 재고 조작 IDOR 취약점 — variantId→product→seller 소유권 검증 미흡

---

## 선행 spec 영향 추적

| 선행 spec | 식별된 결함 항목 | 결함 인지 시점 | 식별 경로 |
|---|---|---|---|
| v1.0.0/002-catalog | SEC-002: `POST /inventory/:variantId/stock-in` 및 `GET /inventory/:variantId/stock`에서 APPROVED 판매자 소유권 미검증 — 타 판매자 재고 조작 가능 (IDOR, Medium) | 2026-06-28 | 002-catalog Security Agent 보안 보고서(security-report.md) |

> **PROC-R03 사전 식별**: SEC-002 수정이 002-catalog SC-041(비소유 판매자 재고 조회 — 200 예상)·SC-042(비소유 판매자 재고 입고 — 201 예상)의 기대값을 403으로 역전시킨다. Design Agent는 해당 테스트 픽스처 마이그레이션을 research.md §F에서 전수 식별하고 본 spec 범위에 포함할지 사용자 확인 후 FR/SC로 명문화한다.

---

## 사용자 스토리

- **US-001**: 인증된 고객으로서, 장바구니에 상품을 추가·수정·제거하고 현재 담긴 아이템을 조회하고 싶다.
- **US-002**: 인증된 고객으로서, 장바구니에서 원하는 아이템을 선택하여 주문을 생성하고 싶다.
- **US-003**: 인증된 고객으로서, 생성된 주문에 대해 결제를 진행하고 싶다.
- **US-004**: 인증된 고객으로서, pending 또는 confirmed 상태의 주문을 취소하고(결제 완료 시 환불 포함) 싶다.
- **US-005**: 인증된 고객으로서, 내 주문 목록과 상세 내역을 조회하고 싶다.
- **US-006**: 인증된 고객으로서, 배송이 완료된 주문의 구매를 확정하고 싶다(수동 또는 7일 자동).
- **US-007**: APPROVED 판매자로서, 내 상품이 포함된 주문을 조회하고 처리 상태(preparing)로 전환하고 싶다.
- **US-008**: APPROVED 판매자로서, 내 상품의 재고만 조작할 수 있어야 한다(타 판매자 재고 접근 차단 — SEC-002).

---

## 기능 요구사항

### 장바구니 (Cart)

- **FR-001**: 인증된 고객은 `POST /cart/items` 로 variantId와 수량을 지정하여 장바구니에 아이템을 추가할 수 있다. 동일 variantId의 아이템이 이미 존재하면 수량이 합산된다.
- **FR-002**: 인증된 고객은 `PATCH /cart/items/:variantId` 로 기존 아이템의 수량을 변경할 수 있다. 수량을 0으로 지정하면 해당 아이템이 장바구니에서 제거된다.
- **FR-003**: 인증된 고객은 `DELETE /cart/items/:variantId` 로 장바구니에서 특정 아이템을 제거할 수 있다.
- **FR-004**: 인증된 고객은 `GET /cart` 로 현재 장바구니의 아이템 목록을 조회할 수 있다.
- **FR-005**: 장바구니는 사용자당 1건이며, `userId`(String)와 JSONB `items` 배열로 구성된다. 비인증 게스트 장바구니는 지원하지 않는다.

### 주문 (Order)

- **FR-010**: 인증된 고객은 `POST /orders` 로 장바구니 아이템 중 일부 또는 전체를 선택하여 주문을 생성할 수 있다. 요청 본문에 `items([{variantId, quantity}])`와 `shippingAddress({recipientName, phone, zipCode, address1, address2?})`를 포함한다.
- **FR-011**: 주문 생성 시 선택된 모든 아이템에 대해 `InventoryService.checkAvailability(variantId, quantity)`를 호출하여 재고 가용성을 확인한다.
- **FR-012**: 재고가 부족한 아이템이 1건이라도 있으면 주문 생성이 거부되며 HTTP 409를 반환한다. 응답에는 재고 부족한 variantId 목록이 포함된다.
- **FR-013**: 재고 가용성 확인 통과 후 `InventoryService.decreaseStock(variantId, quantity, orderId)`를 호출하여 재고를 차감한다. 이 호출은 주문 레코드 생성과 동일 Prisma 트랜잭션 내에서 원자적으로 처리된다.
- **FR-014**: 주문 생성 성공 시 주문에 포함된 아이템이 장바구니에서 제거된다.
- **FR-015**: 주문 생성 직후 초기 상태는 `pending`이다.
- **FR-016**: 주문 생성 시 배송지 정보(`recipientName, phone, zipCode, address1, address2`)가 `shippingAddressSnapshot`(JSONB)으로 주문 레코드에 저장된다.
- **FR-017**: 주문 총 금액(`totalAmount`)은 주문 시점 variant 단가(`unitPrice`) × 수량의 합계이며, `discountAmount`는 0으로 초기화된다(향후 쿠폰 할인 적용을 위한 필드 여지). 모든 금전 값은 Decimal 타입(원 단위 정수)으로 저장된다.
- **FR-018**: 인증된 고객은 `GET /orders` 로 자신의 주문 목록을 최신순으로 조회할 수 있다. ADR-007에 따라 cursor 기반 페이지네이션을 사용한다(`after` 커서, `limit` 파라미터).
- **FR-019**: 인증된 고객은 `GET /orders/:id` 로 자신의 주문 상세를 조회할 수 있다. 타인의 주문 ID로 조회 시 HTTP 403을 반환한다.
- **FR-020**: 인증된 고객은 `DELETE /orders/:id` 로 `pending` 또는 `confirmed` 상태의 자신의 주문을 취소할 수 있다. `preparing` 이후 상태에서는 HTTP 400을 반환한다. 타인의 주문 취소 시도는 HTTP 403을 반환한다.
- **FR-021**: 주문 취소 시 해당 주문에 `completed` 상태의 결제(`payment`)가 존재하면 `PaymentGatewayPort`를 통해 전액 환불이 처리된다. 환불 호출에는 서버에서 `orderId` 기반으로 생성된 idempotency key를 사용한다. 환불 성공 시에만 주문이 `cancelled`로 전환된다.
- **FR-022**: 환불 성공 후 동일 Prisma 트랜잭션 내에서 `payment.status=refunded`, `payment.refunded` outbox 이벤트, `order.status=cancelled`, `order_events` 기록이 처리된다(P-005).
- **FR-023**: 주문 취소 성공 시 `InventoryService.restoreStock(variantId, quantity, orderId)`를 호출하여 해당 주문에서 차감된 재고를 복구한다.

> **FR-023 신규 인터페이스**: 002-catalog에서 정의된 InventoryService 공개 인터페이스는 `checkAvailability`, `decreaseStock`만 포함하며 `restoreStock`은 미정의 상태다. 본 spec은 003에서 `restoreStock(variantId: string, quantity: number, orderId: string): Promise<void>` 인터페이스를 InventoryService에 추가할 것을 요구한다.

- **FR-024**: APPROVED 판매자는 `GET /sellers/me/orders` 로 자신의 상품(`order_items.sellerId`)이 포함된 주문 목록을 조회할 수 있다.
- **FR-025**: APPROVED 판매자는 `PATCH /orders/:id/confirm` 으로 `confirmed` 상태의 주문을 `preparing` 상태로 전환할 수 있다. 해당 주문의 `order_items`에 자신의 `sellerId`가 없으면 HTTP 403을 반환한다.
- **FR-026**: 인증된 고객은 `POST /orders/:id/complete` 로 `delivered` 상태의 자신의 주문을 `completed`(구매 확정) 상태로 수동 전환할 수 있다. 타인의 주문 확정 시도는 HTTP 403을 반환한다.
- **FR-027**: `delivered` 상태가 된 지 7일이 경과한 주문은 pg-boss 스케줄 잡에 의해 자동으로 `completed`로 전환된다(actorType=SYSTEM).
- **FR-028**: 모든 주문 상태 전이마다 `order_events` 테이블에 `(orderId, fromStatus?, toStatus, actorType, actorId?, createdAt)` 레코드가 append-only로 기록된다. 기존 레코드의 수정 또는 삭제는 허용되지 않는다.

### 결제 (Payment)

- **FR-030**: 인증된 고객은 `POST /payments` 로 `pending` 상태의 자신의 주문에 대해 결제를 요청할 수 있다. 요청 본문에 `orderId`를 포함하며, 타인의 주문에 대한 결제 요청은 HTTP 403을 반환한다.
- **FR-031**: 결제 요청에는 클라이언트가 생성한 `Idempotency-Key` HTTP 헤더(UUID v4 형식)가 필수다. 헤더가 없으면 HTTP 400을 반환한다.
- **FR-032**: 결제는 `PaymentGatewayPort` 인터페이스를 통해 처리된다. 본 spec 범위에서는 stub 구현을 제공하며, 실제 PG 연동은 후속 spec으로 위임한다.
- **FR-033**: 결제 성공 시 `payment` 레코드 생성과 `payment.completed` outbox 이벤트 기록이 동일 Prisma 트랜잭션 내에서 처리된다(P-005).
- **FR-034**: `payment.completed` 이벤트가 pg-boss를 통해 처리되면 해당 주문의 상태가 `pending`에서 `confirmed`로 전환된다.
- **FR-035**: 동일 `Idempotency-Key`로 결제 요청이 재전송되면 최초 처리 결과를 반환한다(멱등성 보장). 재처리 없이 원래 응답을 그대로 반환한다.
- **FR-036**: 결제가 실패하면 `payment.status=failed`로 저장되고 주문은 `pending` 상태를 유지한다.
- **FR-037**: 환불 성공 시 `payment.status=refunded`와 `payment.refunded` outbox 이벤트가 동일 Prisma 트랜잭션 내에서 기록된다(P-005, FR-022와 동일 트랜잭션).
- **FR-038**: 이미 `refunded` 상태인 결제에 대해 환불 처리가 재시도될 경우 HTTP 409를 반환한다(orderId 기반 idempotency key 외의 재요청 시).

### SEC-002 수정 (Inventory 소유권 검증)

- **FR-050**: `POST /inventory/:variantId/stock-in` 엔드포인트는 요청한 APPROVED 판매자가 해당 variantId 상품의 소유자인지 검증해야 한다. 검증 방법: `variantId → Variant.productId → Product.sellerId`를 조회하여 요청자의 `sellerId`와 비교한다. 소유자가 아니면 HTTP 403을 반환한다.
- **FR-051**: `GET /inventory/:variantId/stock` 엔드포인트도 동일한 소유권 검증을 적용한다. 소유자가 아니면 HTTP 403을 반환한다.

---

## 비기능 요구사항

- **NFR-001**: `POST /orders` P95 응답 시간은 1,000ms 이하여야 한다(로컬 docker-compose 환경, 아이템 10개 미만 기준).
- **NFR-002**: `POST /payments` P95 응답 시간은 2,000ms 이하여야 한다(stub 구현 기준).
- **NFR-003**: 인증이 필요한 모든 엔드포인트는 유효하지 않거나 없는 JWT 토큰으로 요청 시 HTTP 401을 반환한다.
- **NFR-004**: 주문·결제·환불 관련 상태 전이 엔드포인트는 자원 소유권(orderId/paymentId → userId)을 검증하여 IDOR를 차단한다. 상세는 [PATCH-001 권한 평가 결과](#patch-001-권한-평가-결과) 참조.
- **NFR-005**: 주문 금액(`totalAmount`, `discountAmount`), 결제 금액(`amount`), 단가(`unitPrice`) 등 금전 관련 모든 수치는 Prisma `Decimal` 타입(원 단위 정수)으로 선언한다. 부동소수점(`Float`) 사용을 금지한다(P-005).
- **NFR-006**: `commerce`, `orders`, `payments` 스키마의 각 Repository는 자신의 스키마 테이블에만 Prisma Client로 직접 접근한다. 타 도메인 스키마 테이블에 대한 직접 쿼리는 금지된다(P-001). 타 도메인 데이터는 DI를 통한 서비스 메서드 호출로만 접근한다.
- **NFR-007**: AWS 전용 SDK(`@aws-sdk/*`) 또는 서비스를 신규 의존으로 추가하지 않는다(P-002, P-004).
- **NFR-008**: 결제·환불 상태 변경과 outbox 이벤트 기록은 동일 Prisma 트랜잭션 내에서 처리된다. 트랜잭션 실패 시 양쪽 모두 롤백된다(P-005).

---

## 수용 기준

> **환경 태그 규약**: 모든 SC-XXX 끝에 `[env:*]` 태그를 명시한다.
>
> | 태그 | 의미 |
> |---|---|
> | `[env:static]` | 코드·설정 파일 존재·구조 검증만으로 판정 가능 |
> | `[env:unit]` | 단위 테스트로 판정 가능 |
> | `[env:integration]` | 앱 기동(DB/LLM 목·스텁)으로 판정 가능 |
> | `[env:e2e-docker]` | 실제 Docker 기동 필요 |

### 장바구니 SC

- **SC-001** (`FR-001` 관련): 인증된 고객이 `POST /cart/items` `{variantId, quantity: 2}` 호출 시 201과 함께 아이템이 추가되고, `GET /cart`에서 해당 아이템이 조회된다. [env:unit]
- **SC-002** (`FR-001` 관련): 동일 variantId로 `POST /cart/items` `{quantity: 3}` 재호출 시 기존 수량에 합산되어 총 5가 된다. [env:unit]
- **SC-003** (`FR-002` 관련): `PATCH /cart/items/:variantId` `{quantity: 5}` 호출 시 해당 아이템 수량이 5로 갱신된다. [env:unit]
- **SC-004** (`FR-002` 관련): `PATCH /cart/items/:variantId` `{quantity: 0}` 호출 시 해당 아이템이 장바구니에서 제거된다. [env:unit]
- **SC-005** (`FR-003` 관련): `DELETE /cart/items/:variantId` 호출 시 204와 함께 해당 아이템이 제거된다. [env:unit]
- **SC-006** (`FR-004` 관련): `GET /cart` 호출 시 현재 장바구니 아이템 목록이 반환된다. 장바구니가 비어 있으면 빈 배열이 반환된다. [env:unit]
- **SC-007** (`FR-004`, `FR-005` 관련): 비인증 요청(JWT 없음)으로 장바구니 엔드포인트 접근 시 401이 반환된다. [env:unit]
- **SC-008** (`FR-005` 관련): 서로 다른 두 사용자가 각자 `POST /cart/items`를 호출했을 때 각각의 장바구니는 독립적이며 상대방의 아이템이 보이지 않는다. [env:unit]

### 주문 SC

- **SC-009** (`FR-010` 관련): 인증된 고객이 `POST /orders` `{items:[{variantId, quantity}], shippingAddress:{...}}` 호출 시 201과 함께 주문이 생성된다. [env:unit]
- **SC-010** (`FR-010` 관련): 장바구니에 3개 아이템이 있을 때 그 중 2개만 선택하여 주문 생성이 가능하다. [env:unit]
- **SC-011** (`FR-011`, `FR-012` 관련): 선택한 아이템 중 재고가 부족한 항목이 있으면 409가 반환되며, 응답에 재고 부족 variantId가 포함된다. [env:unit]
- **SC-012** (`FR-013` 관련): 주문 레코드 생성과 재고 차감이 동일 Prisma 트랜잭션 내에서 처리된다. 재고 차감 실패 시 주문 레코드도 롤백된다. [env:unit]
- **SC-013** (`FR-014` 관련): 주문 생성 성공 후 `GET /cart` 호출 시 주문에 포함된 아이템이 장바구니에서 제거되어 있다. [env:unit]
- **SC-014** (`FR-015` 관련): 주문 생성 직후 `GET /orders/:id` 응답의 `status`가 `pending`이다. [env:unit]
- **SC-015** (`FR-016` 관련): 생성된 주문 레코드에 `shippingAddressSnapshot`(JSONB)이 저장된다. [env:unit]
- **SC-016** (`FR-017` 관련): 주문의 `totalAmount` = Σ(`unitPrice` × `quantity`)이고, `discountAmount` = 0이다. [env:unit]
- **SC-017** (`FR-018` 관련): `GET /orders?limit=20` 호출 시 자신의 주문 목록이 최신순으로 반환된다. `nextCursor`가 응답에 포함된다. [env:unit]
- **SC-018** (`FR-019` 관련): `GET /orders/:id` 호출 시 자신의 주문이면 200과 상세 정보가 반환된다. [env:unit]
- **SC-019** (`FR-019` 관련): `GET /orders/:id`에서 타인의 orderId를 사용하면 403이 반환된다. [env:unit]
- **SC-020** (`FR-020` 관련): `DELETE /orders/:id`로 `pending` 상태 주문 취소 시 200이 반환되고 주문이 `cancelled`가 된다. [env:unit]
- **SC-021** (`FR-020` 관련): `DELETE /orders/:id`로 `confirmed` 상태 주문 취소 시 200이 반환되고 주문이 `cancelled`가 된다. [env:unit]
- **SC-022** (`FR-020` 관련): `DELETE /orders/:id`로 `preparing` 상태 주문 취소 시도 시 400이 반환된다. [env:unit]
- **SC-023** (`FR-020` 관련): `DELETE /orders/:id`로 타인의 주문 취소 시도 시 403이 반환된다. [env:unit]
- **SC-024** (`FR-021`, `FR-022` 관련): 취소 요청 시 결제 상태가 `completed`이면 환불이 처리된다. 환불 성공 시 동일 트랜잭션에서 `payment.status=refunded`, `payment.refunded` outbox 이벤트, `order.status=cancelled`가 처리된다. [env:unit]
- **SC-025** (`FR-023` 관련): 주문 취소 성공 시 해당 주문에서 차감된 재고가 복구된다(`InventoryService.restoreStock` 호출 확인). [env:unit]
- **SC-026** (`FR-024` 관련): `GET /sellers/me/orders` 호출 시 APPROVED 판매자의 `sellerId`가 `order_items.sellerId`에 포함된 주문만 반환된다. [env:unit]
- **SC-027** (`FR-025` 관련): APPROVED 판매자가 `PATCH /orders/:id/confirm` 호출 시 `confirmed` 주문이 `preparing`으로 전환된다. [env:unit]
- **SC-028** (`FR-025` 관련): 자신의 상품이 포함되지 않은 주문에 `PATCH /orders/:id/confirm` 시도 시 403이 반환된다. [env:unit]
- **SC-029** (`FR-026` 관련): `POST /orders/:id/complete` 호출 시 `delivered` 상태 자신의 주문이 `completed`로 전환된다. [env:unit]
- **SC-030** (`FR-026` 관련): 타인의 주문에 `POST /orders/:id/complete` 시도 시 403이 반환된다. [env:unit]
- **SC-031** (`FR-027` 관련): pg-boss 스케줄 잡이 `delivered` 상태 7일 경과 주문을 `completed`로 전환하는 로직이 구현된다. 단위 테스트에서 날짜를 mock하여 자동 전환이 검증된다. [env:unit]
- **SC-032** (`FR-028` 관련): 각 주문 상태 전이마다 `order_events` 테이블에 `(orderId, fromStatus, toStatus, actorType, actorId, createdAt)` 레코드가 생성된다. [env:unit]

### 결제 SC

- **SC-033** (`FR-030` 관련): `POST /payments` `{orderId}` + `Idempotency-Key` 헤더로 호출 시 201과 함께 결제가 처리된다. [env:unit]
- **SC-034** (`FR-030` 관련): 타인의 orderId로 `POST /payments` 호출 시 403이 반환된다. [env:unit]
- **SC-035** (`FR-031` 관련): `Idempotency-Key` 헤더 없이 `POST /payments` 호출 시 400이 반환된다. [env:unit]
- **SC-036** (`FR-033` 관련): 결제 성공 시 `payment` 레코드 생성과 `payment.completed` outbox 이벤트 기록이 동일 Prisma 트랜잭션 내에서 처리된다. 트랜잭션 롤백 시 양쪽 모두 미반영된다. [env:unit]
- **SC-037** (`FR-034` 관련): `payment.completed` 이벤트 처리 후 해당 주문의 `status`가 `pending`에서 `confirmed`로 전환된다. [env:unit]
- **SC-038** (`FR-035` 관련): 동일 `Idempotency-Key`로 `POST /payments` 재호출 시 최초 결제 결과가 반환된다(status 변경 없음). [env:unit]
- **SC-039** (`FR-036` 관련): stub 구현이 결제 실패를 반환하도록 설정했을 때 `payment.status=failed`로 저장되고 주문은 `pending` 상태를 유지한다. [env:unit]
- **SC-040** (`FR-037` 관련): 환불 성공 시 `payment.status=refunded`와 `payment.refunded` outbox 이벤트가 동일 Prisma 트랜잭션 내에서 기록된다. [env:unit]
- **SC-041** (`FR-038` 관련): 이미 `refunded` 상태인 결제에 대해 다른 key로 환불 시도 시 409가 반환된다. [env:unit]

### SEC-002 수정 SC

- **SC-042** (`FR-050` 관련): APPROVED 판매자 A가 판매자 B 소유의 variantId로 `POST /inventory/:variantId/stock-in` 호출 시 403이 반환된다. [env:unit]
- **SC-043** (`FR-050` 관련): APPROVED 판매자가 자신의 상품 variantId로 `POST /inventory/:variantId/stock-in` 호출 시 재고가 증가한다(기존 동작 유지). [env:unit]
- **SC-044** (`FR-051` 관련): APPROVED 판매자 A가 판매자 B 소유의 variantId로 `GET /inventory/:variantId/stock` 호출 시 403이 반환된다. [env:unit]

### 비기능 SC

- **SC-045** (`NFR-001` 관련): `POST /orders` P95 응답 시간이 1,000ms 이하임을 로컬 docker-compose 환경에서 10개 이하 아이템 기준으로 확인한다. [env:integration]
- **SC-046** (`NFR-002` 관련): `POST /payments` P95 응답 시간이 2,000ms 이하임을 stub 기준으로 확인한다. [env:integration]
- **SC-047** (`NFR-003` 관련): JWT 없이 인증 필수 엔드포인트 호출 시 401이 반환된다. [env:unit]
- **SC-048** (`NFR-004` 관련): 타인의 orderId로 결제 요청, 타인의 주문 취소 등 IDOR 시나리오에서 403이 반환된다(SC-019, SC-023, SC-034, SC-030 포함). [env:unit]
- **SC-049** (`NFR-005` 관련): `schema.prisma`의 `totalAmount`, `discountAmount`, `amount`, `unitPrice` 필드가 모두 `Decimal` 타입으로 선언되어 있다. `Float` 타입으로 선언된 금전 필드가 없다. [env:static]
- **SC-050** (`NFR-006` 관련): `commerce`, `orders`, `payments` 스키마의 Repository 구현 파일에서 자신의 스키마가 아닌 타 도메인 스키마 Prisma 모델을 직접 참조하는 코드가 없다(grep 정적 검사). [env:static]
- **SC-051** (`NFR-007` 관련): `apps/backend/package.json`의 `dependencies` 및 `devDependencies`에 `@aws-sdk/*` 패키지가 신규 추가되지 않는다. [env:static]
- **SC-052** (`NFR-008` 관련): 결제 성공 처리 중 outbox 이벤트 기록이 실패하도록 mock했을 때 `payment` 레코드도 함께 롤백된다(트랜잭션 원자성 단위 테스트). [env:unit]

---

## 요구사항 구조화 매트릭스

> 매핑 누락(SC 없는 FR/NFR, FR/NFR 없는 SC) 0건이 완료 조건이다.
> MoSCoW: Must / Should / Could / Won't

| US-ID | FR-ID | NFR-ID | SC-ID | [env:*] | MoSCoW |
|---|---|---|---|---|---|
| US-001 | FR-001 | — | SC-001, SC-002 | unit | Must |
| US-001 | FR-002 | — | SC-003, SC-004 | unit | Must |
| US-001 | FR-003 | — | SC-005 | unit | Must |
| US-001 | FR-004 | — | SC-006 | unit | Must |
| US-001 | FR-005 | — | SC-007, SC-008 | unit | Must |
| US-002 | FR-010 | NFR-001 | SC-009, SC-010 | unit, integration | Must |
| US-002 | FR-011 | — | SC-011 | unit | Must |
| US-002 | FR-012 | — | SC-011 | unit | Must |
| US-002 | FR-013 | NFR-006 | SC-012 | unit | Must |
| US-002 | FR-014 | — | SC-013 | unit | Must |
| US-002 | FR-015 | — | SC-014 | unit | Must |
| US-002 | FR-016 | — | SC-015 | unit | Must |
| US-002 | FR-017 | NFR-005 | SC-016 | unit | Must |
| US-002 | FR-028 | — | SC-032 | unit | Must |
| US-003 | FR-030 | NFR-002, NFR-003, NFR-004 | SC-033, SC-034 | unit, integration | Must |
| US-003 | FR-031 | — | SC-035 | unit | Must |
| US-003 | FR-032 | — | SC-033 | unit | Must |
| US-003 | FR-033 | NFR-005, NFR-008 | SC-036, SC-052 | unit | Must |
| US-003 | FR-034 | — | SC-037 | unit | Must |
| US-003 | FR-035 | — | SC-038 | unit | Must |
| US-003 | FR-036 | — | SC-039 | unit | Must |
| US-004 | FR-020 | NFR-003, NFR-004 | SC-020, SC-021, SC-022, SC-023 | unit | Must |
| US-004 | FR-021 | — | SC-024 | unit | Must |
| US-004 | FR-022 | NFR-005, NFR-008 | SC-024, SC-040 | unit | Must |
| US-004 | FR-023 | — | SC-025 | unit | Must |
| US-004 | FR-037 | NFR-008 | SC-040 | unit | Must |
| US-004 | FR-038 | — | SC-041 | unit | Must |
| US-005 | FR-018 | NFR-003 | SC-017 | unit | Must |
| US-005 | FR-019 | NFR-003, NFR-004 | SC-018, SC-019 | unit | Must |
| US-006 | FR-026 | NFR-003, NFR-004 | SC-029, SC-030 | unit | Must |
| US-006 | FR-027 | — | SC-031 | unit | Should |
| US-007 | FR-024 | NFR-003 | SC-026 | unit | Must |
| US-007 | FR-025 | NFR-003, NFR-004 | SC-027, SC-028 | unit | Must |
| US-008 | FR-050 | — | SC-042, SC-043 | unit | Must |
| US-008 | FR-051 | — | SC-044 | unit | Must |
| — | — | NFR-001 | SC-045 | integration | Should |
| — | — | NFR-002 | SC-046 | integration | Should |
| — | — | NFR-003 | SC-047 | unit | Must |
| — | — | NFR-004 | SC-048 | unit | Must |
| — | — | NFR-005 | SC-049 | static | Must |
| — | — | NFR-006 | SC-050 | static | Must |
| — | — | NFR-007 | SC-051 | static | Must |
| — | — | NFR-008 | SC-052 | unit | Must |

---

## PATCH-001 권한 평가 결과

> 모든 상태 전이 엔드포인트에 대해 인가 3축(호출자 신원·자원 소유권·역할) 평가.

| 엔드포인트 | 위험도 | 완화책 | 대응 SC |
|---|---|---|---|
| `POST /orders` | 낮음 | JWT에서 추출한 userId를 서버에서 자동 적용 (조작 불가) | SC-009 |
| `DELETE /orders/:id` | 중간 | orderId → orders.userId 조회 후 JWT userId와 비교, 불일치 시 403 | SC-023 |
| `POST /payments` | 높음 | orderId → orders.userId 조회 후 JWT userId와 비교 + pending 상태 검증 | SC-034 |
| `POST /orders/:id/complete` | 중간 | orderId → orders.userId 조회 후 JWT userId 비교, 불일치 시 403 | SC-030 |
| `PATCH /orders/:id/confirm` | 중간 | sellerId가 order_items에 존재하는지 확인 (다수 판매자 주문 지원) | SC-028 |
| `GET /inventory/:variantId/stock` | 중간(SEC-002) | variantId → Variant.productId → Product.sellerId → JWT sellerId 비교, 불일치 시 403 | SC-044 |
| `POST /inventory/:variantId/stock-in` | 중간(SEC-002) | variantId → Variant.productId → Product.sellerId → JWT sellerId 비교, 불일치 시 403 | SC-042 |

---

## 범위 외

- **배송(Shipping)**: 배송 추적, 운송장 번호 관리, 배송업체 연동 — 별도 spec으로 위임
- **정산(Settlement)**: 판매자 정산 계산, 정산 일정, 정산 내역 조회 — 별도 spec으로 위임
- **리뷰(Review)**: 구매 후 리뷰 작성, 평점 관리 — 별도 spec으로 위임
- **쿠폰(Coupon) 적용**: 주문 생성 시 쿠폰 할인 적용 로직 (`discountAmount` 필드는 향후 적용을 위해 0으로 초기화만 함)
- **부분 환불(Partial Refund)**: 주문 일부 아이템만 환불 — 본 spec은 전액 환불만 지원
- **게스트 장바구니**: 비로그인 고객 장바구니 — 본 spec은 인증 사용자만 지원
- **실제 PG 연동**: 실제 결제 게이트웨이(토스페이먼츠, 아임포트 등) 연동 — `PaymentGatewayPort` 어댑터 stub으로 대체, 실 PG는 후속 spec
- **판매자 직접 취소**: `preparing` 이후 상태에서의 판매자 협의 취소 — 고객 직접 취소는 차단(`400`)만 구현

### 사후 운영 검증 피드백 사이클

본 spec 파이프라인 종료 후 운영 환경에서 점검할 시나리오:

1. **결제 중복 요청 시나리오**: 동일 `Idempotency-Key`로 `POST /payments` 2회 연속 호출 — 두 번째 호출이 원래 결과를 반환하는지 확인
2. **주문 취소 + 환불 시나리오**: `POST /payments` 후 `DELETE /orders/:id` — stub 환불 성공 → 주문 `cancelled`, 재고 복구 확인
3. **자동 구매 확정 시나리오**: `delivered` 상태 주문이 7일 후 pg-boss 잡에 의해 `completed`로 전환되는지 확인

결함 발견 시 처리 절차: 결함 정보를 본 spec.md 배경 및 목적 절에 반영하거나 별도 hotfix spec 입력 → main session 의 "spec 수정" 이벤트 → 1단계 재진입 또는 별도 patch spec.

---

## 미결 사항

없음 — 모든 항목이 사용자 확인 완료.
