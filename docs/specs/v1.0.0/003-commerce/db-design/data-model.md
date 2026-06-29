---
작성: Database Design Agent
버전: v1.0
최종 수정: 2026-06-28 23:00
상태: 확정
---

# Data Model: 003-commerce

> Spec: [../spec/spec.md](../spec/spec.md) | Plan: [../planning/plan.md](../planning/plan.md)

## 목차

- [DB 선택 및 근거](#db-선택-및-근거)
- [엔티티 관계도 (ERD)](#엔티티-관계도-erd)
- [테이블 정의](#테이블-정의)
  - [products 스키마 — enum 확장](#products-스키마--enum-확장)
  - [commerce 스키마 — carts](#commerce-스키마--carts)
  - [orders 스키마 — orders·order_items·order_events](#orders-스키마--ordersorder_itemsorder_events)
  - [payments 스키마 — payments·refunds·payment_outbox](#payments-스키마--paymentsrefundspayment_outbox)
- [인덱스 전략](#인덱스-전략)
- [데이터 무결성 규칙](#데이터-무결성-규칙)
- [마이그레이션 계획](#마이그레이션-계획)
- [롤백 전략](#롤백-전략)

---

## DB 선택 및 근거

- **DB**: PostgreSQL 16 (기존 단일 인스턴스 계승 — constitution P-003)
- **ORM**: Prisma 6.x multiSchema (GA — previewFeatures 불요)
- **스키마 전략**: commerce·orders·payments 스키마에 신규 테이블 추가. pgboss 스키마는 런타임 자동 생성(마이그레이션 대상 아님 — GAP-001)
- **금전 타입**: `Decimal(12, 2)` — P-005, NFR-005. Float 사용 금지.

---

## 엔티티 관계도 (ERD)

```
[users 스키마]          [products 스키마]
  users.id ──────────────→ InventoryLogType +RESTORE
  sellers.id               (additive enum, FR-023)

  (cross-schema 참조: P-001 — FK 미선언, plain String)

[commerce 스키마]
  carts
    ├── userId ─────────→ (users.users.id, plain String)
    └── items: JSONB[]

[orders 스키마]
  orders
    ├── userId ──────────→ (users.users.id, plain String)
    ├── status: OrderStatus
    ├── totalAmount: Decimal
    ├── discountAmount: Decimal
    ├── shippingAddressSnapshot: JSONB
    └── deliveredAt: DateTime?
    │
    ├──< order_items (FK 동일스키마)
    │       ├── variantId ───→ (products.variants.id, plain String)
    │       ├── productId ───→ (products.products.id, plain String)
    │       ├── sellerId ────→ (users.sellers.id, plain String)
    │       └── unitPrice: Decimal
    │
    └──< order_events (FK 동일스키마, append-only)
            ├── fromStatus: String?
            ├── toStatus: String
            └── actorType: ActorType

[payments 스키마]
  payments
    ├── orderId ─────────→ (orders.orders.id, plain String, @unique)
    ├── userId ──────────→ (users.users.id, plain String)
    ├── amount: Decimal
    ├── status: PaymentStatus
    └── idempotencyKey: String (@unique — 멱등성 guard)
    │
    ├──< refunds (FK 동일스키마)
    │       ├── amount: Decimal
    │       └── idempotencyKey: String (@unique — 이중환불 guard)
    │
    └──< payment_outbox (FK 동일스키마)
            ├── eventType: String (payment.completed | payment.refunded)
            ├── payload: JSONB ({orderId, ...})
            └── status: String (pending | processed)
```

**Cross-schema 참조 규칙 (P-001, NFR-006)**:
- `@@schema` 가 다른 테이블 간 FK 미선언 — plain String 참조
- 동일 스키마 내에서만 `@relation` 선언 (orders↔order_items↔order_events, payments↔refunds↔payment_outbox)

---

## 테이블 정의

### products 스키마 — enum 확장

#### InventoryLogType (기존 enum — RESTORE 추가)

| 값 | 의미 | 변경 | 근거 |
|---|---|---|---|
| `STOCK_IN` | 재고 입고 | 기존 | — |
| `DECREASE` | 재고 차감 (주문) | 기존 | — |
| `INIT` | 초기 재고 설정 | 기존 | — |
| `RESTORE` | 재고 복구 (주문 취소) | **신규 추가** | FR-023, ADR-004 |

> additive 변경 — 기존 값 영향 없음.

---

### commerce 스키마 — carts

#### Cart (commerce.carts)

| 컬럼 | 타입(Prisma) | DB 타입 | 제약 | 설명 |
|---|---|---|---|---|
| `id` | `String` | `TEXT` | `PK, @default(cuid())` | 장바구니 식별자 |
| `userId` | `String` | `TEXT` | `@unique` | 사용자 ID — cross-schema plain String (users.users.id, P-001) |
| `items` | `Json` | `JSONB` | `@default("[]")` | 장바구니 아이템 배열 (FR-005) |
| `createdAt` | `DateTime` | `TIMESTAMP(3)` | `@default(now())` | 생성 일시 |
| `updatedAt` | `DateTime` | `TIMESTAMP(3)` | `@updatedAt` | 갱신 일시 |

**items JSONB 구조** (FR-005, plan.md §2):
```json
[
  {
    "variantId": "string",
    "productId": "string",
    "sellerId": "string",
    "quantity": 1,
    "unitPrice": "10000.00",
    "optionName": "string",
    "optionValue": "string",
    "productTitle": "string",
    "sku": "string",
    "imageUrl": "string?"
  }
]
```

> unitPrice 는 JSONB 내에서 string 형태로 저장 (Decimal 직렬화). DB 레벨 Decimal 타입은 order_items.unitPrice 에서 보장.

---

### orders 스키마 — orders·order_items·order_events

#### OrderStatus (enum)

```
pending → confirmed → preparing → shipped → delivered → completed
                ↘ cancelled (pending/confirmed에서만 가능, FR-020)
```

| 값 | 의미 | 전이 조건 |
|---|---|---|
| `pending` | 주문 생성 직후 | 초기값 |
| `confirmed` | 결제 완료 확인 | payment.completed outbox 처리 (FR-034) |
| `preparing` | 판매자 주문 처리 중 | 판매자 확인 (FR-025) |
| `shipped` | 배송 중 | 배송 등록 (후속 spec) |
| `delivered` | 배송 완료 | 배송 추적 업데이트 (후속 spec) |
| `completed` | 구매 확정 | 수동(FR-026) 또는 7일 자동(FR-027) |
| `cancelled` | 취소 | pending/confirmed에서만 (FR-020) |

#### ActorType (enum)

| 값 | 의미 |
|---|---|
| `CUSTOMER` | 고객 행위자 |
| `SELLER` | 판매자 행위자 |
| `ADMIN` | 관리자 행위자 |
| `SYSTEM` | 시스템 행위자 (pg-boss, auto-confirm) |

#### Order (orders.orders)

| 컬럼 | 타입(Prisma) | DB 타입 | 제약 | 설명 |
|---|---|---|---|---|
| `id` | `String` | `TEXT` | `PK, @default(cuid())` | 주문 식별자 (ADR-009 선생성) |
| `userId` | `String` | `TEXT` | `NOT NULL` | 고객 ID — cross-schema plain String (users.users.id, P-001) |
| `status` | `OrderStatus` | `orders."OrderStatus"` | `@default(pending)` | 주문 상태 (FR-015) |
| `totalAmount` | `Decimal` | `DECIMAL(12,2)` | `NOT NULL` | 주문 총액 (FR-017, NFR-005, P-005) |
| `discountAmount` | `Decimal` | `DECIMAL(12,2)` | `@default(0)` | 할인액 (향후 쿠폰 적용, FR-017) |
| `shippingAddressSnapshot` | `Json` | `JSONB` | `NOT NULL` | 배송지 스냅샷 (FR-016) |
| `deliveredAt` | `DateTime?` | `TIMESTAMP(3)` | `NULL` | 배송 완료 일시 (FR-027 자동확정 기준) |
| `createdAt` | `DateTime` | `TIMESTAMP(3)` | `@default(now())` | 주문 생성 일시 |

**shippingAddressSnapshot JSONB 구조** (FR-016):
```json
{
  "recipientName": "string",
  "phone": "string",
  "zipCode": "string",
  "address1": "string",
  "address2": "string?"
}
```

#### OrderItem (orders.order_items)

| 컬럼 | 타입(Prisma) | DB 타입 | 제약 | 설명 |
|---|---|---|---|---|
| `id` | `String` | `TEXT` | `PK, @default(cuid())` | 주문 항목 식별자 |
| `orderId` | `String` | `TEXT` | `NOT NULL, FK→orders` | 주문 ID (동일 스키마 FK) |
| `variantId` | `String` | `TEXT` | `NOT NULL` | variant ID — cross-schema plain String (products.variants.id, P-001) |
| `productId` | `String` | `TEXT` | `NOT NULL` | 상품 ID — cross-schema plain String (products.products.id, P-001) |
| `sellerId` | `String` | `TEXT` | `NOT NULL` | 판매자 ID — cross-schema plain String (users.sellers.id, P-001) |
| `quantity` | `Int` | `INTEGER` | `NOT NULL` | 주문 수량 |
| `unitPrice` | `Decimal` | `DECIMAL(12,2)` | `NOT NULL` | 주문 시점 단가 스냅샷 (FR-017, P-005) |
| `optionName` | `String` | `TEXT` | `NOT NULL` | 옵션명 (예: 색상) |
| `optionValue` | `String` | `TEXT` | `NOT NULL` | 옵션값 (예: 빨간색) |
| `productTitle` | `String` | `TEXT` | `NOT NULL` | 상품명 스냅샷 (주문 시점 고정) |
| `sku` | `String` | `TEXT` | `NOT NULL` | SKU |

> sellerId 는 판매자 수주 목록 조회 (FR-024, SC-026) 와 판매자 주문 확인 권한 검증 (FR-025) 에 사용.

#### OrderEvent (orders.order_events)

| 컬럼 | 타입(Prisma) | DB 타입 | 제약 | 설명 |
|---|---|---|---|---|
| `id` | `String` | `TEXT` | `PK, @default(cuid())` | 이벤트 식별자 |
| `orderId` | `String` | `TEXT` | `NOT NULL, FK→orders` | 주문 ID (동일 스키마 FK) |
| `fromStatus` | `String?` | `TEXT` | `NULL` | 전이 전 상태 (최초 생성 시 NULL) |
| `toStatus` | `String` | `TEXT` | `NOT NULL` | 전이 후 상태 |
| `actorType` | `ActorType` | `orders."ActorType"` | `NOT NULL` | 행위자 유형 (FR-028) |
| `actorId` | `String?` | `TEXT` | `NULL` | 행위자 ID (SYSTEM 행위자 시 NULL 가능) |
| `createdAt` | `DateTime` | `TIMESTAMP(3)` | `@default(now())` | 전이 일시 |

> **append-only**: 코드 레벨에서 UPDATE/DELETE 미사용 (FR-028). DB 레벨 제약은 적용하지 않음 — 검증은 정적 테스트(inventory-log-append-only 패턴 승계).

> `fromStatus`·`toStatus` 를 `String` 으로 사용한 이유: `OrderStatus` enum 을 직접 참조하면 향후 enum 값 추가 시 이벤트 이력 스키마 변경이 연동되어 부담이 커짐. 이벤트 이력은 문자열로 자유 표현이 더 유연하며, 불변 이력 보존이 목적.

---

### payments 스키마 — payments·refunds·payment_outbox

#### PaymentStatus (enum)

```
pending → completed       (결제 성공)
        ↘ failed          (결제 실패, FR-036)
completed → refund_pending (환불 처리 중 — context.md §3.3)
refund_pending → refunded  (환불 완료, FR-037)
```

| 값 | 의미 |
|---|---|
| `pending` | 결제 요청 전/처리 중 |
| `completed` | 결제 완료 |
| `failed` | 결제 실패 (FR-036) |
| `refund_pending` | 환불 처리 중 (context.md §3.3 목표 상태머신) |
| `refunded` | 환불 완료 (FR-037) |

> 본 spec(003)의 실제 흐름은 `completed → refunded` 직행(plan.md §4 — `PaymentGatewayPort.refund` 성공 후 즉시 refunded). `refund_pending` 은 context.md 목표 상태머신에 명시된 중간 상태로 향후 실 PG 연동(비동기 환불 처리) 시 활성화. 미리 enum 에 포함하여 마이그레이션 비용 절감.

#### Payment (payments.payments)

| 컬럼 | 타입(Prisma) | DB 타입 | 제약 | 설명 |
|---|---|---|---|---|
| `id` | `String` | `TEXT` | `PK, @default(cuid())` | 결제 식별자 |
| `orderId` | `String` | `TEXT` | `@unique` | 주문 ID — cross-schema plain String (orders.orders.id, P-001). order당 결제 1건 |
| `userId` | `String` | `TEXT` | `NOT NULL` | 사용자 ID — cross-schema plain String (users.users.id, P-001) |
| `amount` | `Decimal` | `DECIMAL(12,2)` | `NOT NULL` | 결제 금액 (P-005, NFR-005) |
| `status` | `PaymentStatus` | `payments."PaymentStatus"` | `@default(pending)` | 결제 상태 |
| `idempotencyKey` | `String` | `TEXT` | `@unique` | 클라이언트 UUID v4 — 멱등성 race guard (ADR-006, FR-031/035) |
| `pgTransactionId` | `String?` | `TEXT` | `NULL` | PG사 트랜잭션 ID |
| `failureReason` | `String?` | `TEXT` | `NULL` | 결제 실패 사유 (FR-036) |
| `createdAt` | `DateTime` | `TIMESTAMP(3)` | `@default(now())` | 결제 요청 일시 |

**멱등성 설계**:
- `idempotencyKey @unique`: 동일 Idempotency-Key 동시 2요청 시 DB INSERT unique 위반 → 두 번째 요청은 기존 레코드 조회 후 최초 결과 반환 (FR-035, ADR-006)
- `orderId @unique`: order당 결제 1건 강제 (plan.md 데이터 모델)

#### Refund (payments.refunds)

| 컬럼 | 타입(Prisma) | DB 타입 | 제약 | 설명 |
|---|---|---|---|---|
| `id` | `String` | `TEXT` | `PK, @default(cuid())` | 환불 식별자 |
| `paymentId` | `String` | `TEXT` | `NOT NULL, FK→payments` | 결제 ID (동일 스키마 FK) |
| `amount` | `Decimal` | `DECIMAL(12,2)` | `NOT NULL` | 환불 금액 (P-005) |
| `idempotencyKey` | `String` | `TEXT` | `@unique` | 서버 생성 key (`refund:${orderId}`) — 이중환불 guard (ADR-008, FR-038) |
| `status` | `String` | `TEXT` | `NOT NULL` | 환불 상태 (현재: completed 고정) |
| `pgRefundId` | `String?` | `TEXT` | `NULL` | PG사 환불 ID |
| `createdAt` | `DateTime` | `TIMESTAMP(3)` | `@default(now())` | 환불 처리 일시 |

**이중 환불 방지 설계**:
- `idempotencyKey @unique`: `refund:${orderId}` 형식으로 서버 생성 → 동일 주문 환불 재시도 시 멱등 처리 (FR-038, ADR-008)
- `payment.status === 'refunded' && 다른 key` → 409 (FR-038, SC-041)

#### PaymentOutbox (payments.payment_outbox)

| 컬럼 | 타입(Prisma) | DB 타입 | 제약 | 설명 |
|---|---|---|---|---|
| `id` | `String` | `TEXT` | `PK, @default(cuid())` | outbox 이벤트 식별자 |
| `paymentId` | `String` | `TEXT` | `NOT NULL, FK→payments` | 결제 ID (동일 스키마 FK) |
| `eventType` | `String` | `TEXT` | `NOT NULL` | `payment.completed` 또는 `payment.refunded` |
| `payload` | `Json` | `JSONB` | `NOT NULL` | 이벤트 페이로드 `{orderId, ...}` |
| `status` | `String` | `TEXT` | `@default("pending")` | `pending` / `processed` |
| `createdAt` | `DateTime` | `TIMESTAMP(3)` | `@default(now())` | 이벤트 기록 일시 |
| `processedAt` | `DateTime?` | `TIMESTAMP(3)` | `NULL` | 처리 완료 일시 |

**at-least-once 설계**:
- outbox 행은 결제/환불과 동일 트랜잭션 내 기록 (FR-033, FR-037, NFR-008) → 트랜잭션 실패 시 outbox도 롤백
- pg-boss OutboxRelay 가 `status=pending` 행을 폴링 → `OrderService.markConfirmed(orderId)` → `status=processed` 갱신 (ADR-007)
- 처리 실패 시 다음 폴링 주기에 재처리 (at-least-once), `markConfirmed` 는 멱등 (이미 confirmed → no-op)

---

## 인덱스 전략

| 테이블 | 인덱스 | 목적 |
|---|---|---|
| `commerce.carts` | `UNIQUE(userId)` | 사용자당 1건 강제 + 빠른 userId 조회 |
| `orders.orders` | `INDEX(userId, createdAt DESC, id DESC)` | FR-018 cursor 페이지네이션 (NFR-001 P95 1,000ms) |
| `orders.order_items` | `INDEX(orderId)` | 주문 항목 조회 |
| `orders.order_items` | `INDEX(sellerId)` | FR-024 판매자 수주 목록 조회 |
| `orders.order_events` | `INDEX(orderId, createdAt DESC)` | 주문 이벤트 이력 조회 |
| `payments.payments` | `UNIQUE(orderId)` | order당 결제 1건 강제 |
| `payments.payments` | `UNIQUE(idempotencyKey)` | 멱등성 race guard |
| `payments.refunds` | `INDEX(paymentId)` | 결제별 환불 조회 |
| `payments.refunds` | `UNIQUE(idempotencyKey)` | 이중환불 guard |
| `payments.payment_outbox` | `INDEX(status, createdAt ASC)` | OutboxRelay pending 행 폴링 |
| `payments.payment_outbox` | `INDEX(paymentId)` | 결제별 outbox 조회 |

**인덱스 커버리지 분석**:
- 주문 목록 (`GET /orders?limit=N`) → `(userId, createdAt DESC, id DESC)` 복합 인덱스가 WHERE+ORDER BY 완전 커버
- 판매자 수주 목록 (`GET /sellers/me/orders`) → `order_items.sellerId` 인덱스 + orders JOIN
- outbox 폴링 → `(status, createdAt ASC)` 복합 인덱스가 `WHERE status='pending' ORDER BY createdAt` 완전 커버
- 슬로우 쿼리 위험: 전체 주문 스캔 없음 (userId 항상 WHERE 조건). order_items JOIN 시 orderId 인덱스로 N+1 방지.

---

## 데이터 무결성 규칙

### 제약 조건 요약

| 유형 | 대상 | 규칙 |
|---|---|---|
| UNIQUE | `carts.userId` | 사용자당 장바구니 1건 (FR-005) |
| UNIQUE | `payments.orderId` | 주문당 결제 1건 |
| UNIQUE | `payments.idempotencyKey` | 결제 멱등성 (FR-031/035, ADR-006) |
| UNIQUE | `refunds.idempotencyKey` | 환불 멱등성 (FR-038, ADR-008) |
| FK(동일스키마) | `order_items.orderId → orders.id` | 주문-항목 무결성 |
| FK(동일스키마) | `order_events.orderId → orders.id` | 주문-이벤트 무결성 |
| FK(동일스키마) | `refunds.paymentId → payments.id` | 결제-환불 무결성 |
| FK(동일스키마) | `payment_outbox.paymentId → payments.id` | 결제-outbox 무결성 |
| Decimal(12,2) | `totalAmount, discountAmount, unitPrice, amount, refunds.amount` | 금전 부동소수점 금지 (P-005, NFR-005) |

### Cross-schema 참조 (P-001 — FK 미선언 plain String)

| 필드 | 참조 대상 | 이유 |
|---|---|---|
| `carts.userId` | `users.users.id` | cross-schema FK 금지 (P-001) |
| `orders.userId` | `users.users.id` | cross-schema FK 금지 |
| `order_items.variantId` | `products.variants.id` | cross-schema FK 금지 |
| `order_items.productId` | `products.products.id` | cross-schema FK 금지 |
| `order_items.sellerId` | `users.sellers.id` | cross-schema FK 금지 |
| `payments.orderId` | `orders.orders.id` | cross-schema FK 금지 |
| `payments.userId` | `users.users.id` | cross-schema FK 금지 |

> plain String 참조로 인한 DB 수준 참조 무결성 부재는 의도적 트레이드오프 (ADR-001, P-001). 애플리케이션 레벨에서 소유권 검증으로 보완 (FR-019/020/030 등 403 처리).

### append-only 제약 (order_events)

DB 레벨 트리거 없음 — 애플리케이션 레벨 코드 규약으로 강제 (FR-028). 정적 테스트 `inventory-log-append-only` 패턴 승계하여 SC-032 검증.

---

## 마이그레이션 계획

### 파일

```
db-design/migrations/
└── 20260628230000_003_commerce_schema.sql  (Up + Down 쌍)
```

### 실행 방법

1. `schema.prisma` 에 신규 모델/enum 추가 (본 설계 기준)
2. `pnpm --filter backend exec prisma migrate dev --name 003_commerce_schema`
3. Prisma 가 `apps/backend/prisma/migrations/{timestamp}_003_commerce_schema/migration.sql` 자동 생성

> `db-design/migrations/20260628230000_003_commerce_schema.sql` 는 설계 검증용 SQL. 실제 마이그레이션은 Prisma CLI 경유 생성 권장.

### 마이그레이션 순서 (Up)

1. `products."InventoryLogType"` enum 에 `RESTORE` 값 추가
2. `orders."OrderStatus"` enum 생성
3. `orders."ActorType"` enum 생성
4. `payments."PaymentStatus"` enum 생성
5. `commerce."carts"` 테이블 생성
6. `orders."orders"` 테이블 생성
7. `orders."order_items"` 테이블 생성 (orders FK)
8. `orders."order_events"` 테이블 생성 (orders FK)
9. `payments."payments"` 테이블 생성
10. `payments."refunds"` 테이블 생성 (payments FK)
11. `payments."payment_outbox"` 테이블 생성 (payments FK)
12. 인덱스 생성

---

## 롤백 전략

### 주의사항

PostgreSQL 은 `ALTER TYPE ... ADD VALUE` 롤백(enum 값 제거)을 직접 지원하지 않는다. `InventoryLogType.RESTORE` Down 마이그레이션은 RESTORE 타입 행 삭제 + enum 재생성 방식을 사용하며 **데이터 손실** 위험이 있다.

**권장 롤백 절차**:
1. `InventoryLogType.RESTORE` 를 사용하는 `inventory_logs` 행이 0건인지 확인
2. 0건이면 Down 마이그레이션 실행
3. 0건이 아니면 데이터 백업 후 실행 또는 롤백 포기 + 핫픽스 spec 진행

### Down 순서 (역순)

1. 인덱스 삭제
2. `payment_outbox` 테이블 삭제
3. `refunds` 테이블 삭제
4. `payments` 테이블 삭제
5. `order_events` 테이블 삭제
6. `order_items` 테이블 삭제
7. `orders` 테이블 삭제
8. `carts` 테이블 삭제
9. `PaymentStatus` enum 삭제
10. `ActorType` enum 삭제
11. `OrderStatus` enum 삭제
12. `InventoryLogType.RESTORE` 제거 (enum 재생성 방식)
