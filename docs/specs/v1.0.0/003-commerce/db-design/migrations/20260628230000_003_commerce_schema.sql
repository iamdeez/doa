-- =============================================================================
-- Migration: 003-commerce schema extension
-- Spec: 003-commerce | Date: 2026-06-28
--
-- 변경 내용:
--   products."InventoryLogType"   +RESTORE (additive, FR-023)
--   orders."OrderStatus"          신규 enum
--   orders."ActorType"            신규 enum
--   payments."PaymentStatus"      신규 enum
--   commerce."carts"              신규 테이블 (FR-005)
--   orders."orders"               신규 테이블 (FR-015)
--   orders."order_items"          신규 테이블 (FR-017)
--   orders."order_events"         신규 테이블 (FR-028, append-only)
--   payments."payments"           신규 테이블 (FR-031)
--   payments."refunds"            신규 테이블 (FR-038)
--   payments."payment_outbox"     신규 테이블 (FR-033, outbox pattern)
-- =============================================================================


-- =============================================================================
-- UP
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: InventoryLogType.RESTORE 추가
--   NOTE: PostgreSQL 16은 ALTER TYPE ADD VALUE 를 트랜잭션 블록 내에서
--         실행하면 같은 트랜잭션에서 해당 값을 사용할 수 없다.
--         Prisma migrate dev 는 이 구문을 단독 실행한다.
-- -----------------------------------------------------------------------------
ALTER TYPE products."InventoryLogType" ADD VALUE 'RESTORE';

-- 이하 DDL 을 단일 트랜잭션으로 묶는다
BEGIN;

-- -----------------------------------------------------------------------------
-- Step 2: orders."OrderStatus" enum 생성 (FR-015, context.md §3.3)
-- 상태 전이: pending → confirmed → preparing → shipped → delivered → completed
--           pending/confirmed → cancelled
-- -----------------------------------------------------------------------------
CREATE TYPE orders."OrderStatus" AS ENUM (
  'pending',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'completed',
  'cancelled'
);

-- -----------------------------------------------------------------------------
-- Step 3: orders."ActorType" enum 생성 (FR-028)
-- -----------------------------------------------------------------------------
CREATE TYPE orders."ActorType" AS ENUM (
  'CUSTOMER',
  'SELLER',
  'ADMIN',
  'SYSTEM'
);

-- -----------------------------------------------------------------------------
-- Step 4: payments."PaymentStatus" enum 생성 (context.md §3.3)
-- 상태 전이: pending → completed | failed
--           completed → refund_pending → refunded
-- refund_pending 은 context.md §3.3 목표 상태 — 향후 비동기 PG 연동 시 활성화
-- -----------------------------------------------------------------------------
CREATE TYPE payments."PaymentStatus" AS ENUM (
  'pending',
  'completed',
  'failed',
  'refund_pending',
  'refunded'
);

-- -----------------------------------------------------------------------------
-- Step 5: commerce."carts" 테이블 생성 (FR-005)
-- userId @unique: 사용자당 장바구니 1건
-- items JSONB: 장바구니 아이템 배열 (variantId/productId/sellerId/quantity 등)
-- userId cross-schema plain String — users.users.id 참조하지만 FK 미선언 (P-001)
-- -----------------------------------------------------------------------------
CREATE TABLE commerce."carts" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "items"     JSONB        NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- userId UNIQUE: 사용자당 장바구니 1건 강제
CREATE UNIQUE INDEX "carts_userId_key" ON commerce."carts" ("userId");

-- -----------------------------------------------------------------------------
-- Step 6: orders."orders" 테이블 생성 (FR-015, FR-017)
-- userId cross-schema plain String — users.users.id (P-001)
-- totalAmount/discountAmount: Decimal(12,2) — P-005 금전 필드
-- shippingAddressSnapshot: JSONB — 주문 시점 배송지 고정 (FR-016)
-- deliveredAt: 자동 구매 확정 기준 (FR-027)
-- -----------------------------------------------------------------------------
CREATE TABLE orders."orders" (
  "id"                      TEXT                 NOT NULL,
  "userId"                  TEXT                 NOT NULL,
  "status"                  orders."OrderStatus" NOT NULL DEFAULT 'pending',
  "totalAmount"             DECIMAL(12, 2)       NOT NULL,
  "discountAmount"          DECIMAL(12, 2)       NOT NULL DEFAULT 0,
  "shippingAddressSnapshot" JSONB                NOT NULL,
  "deliveredAt"             TIMESTAMP(3),
  "createdAt"               TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- cursor 페이지네이션 복합 인덱스: FR-018, NFR-001 P95 1,000ms
CREATE INDEX "orders_userId_createdAt_id_idx"
  ON orders."orders" ("userId", "createdAt" DESC, "id" DESC);

-- -----------------------------------------------------------------------------
-- Step 7: orders."order_items" 테이블 생성 (FR-017)
-- orderId: 동일 스키마 FK (P-001 — FK 허용)
-- variantId/productId/sellerId: cross-schema plain String (P-001 — FK 미선언)
-- unitPrice: Decimal(12,2) — 주문 시점 단가 스냅샷 (P-005)
-- sellerId: 판매자 수주 목록/권한 검증 (FR-024, FR-025)
-- -----------------------------------------------------------------------------
CREATE TABLE orders."order_items" (
  "id"           TEXT           NOT NULL,
  "orderId"      TEXT           NOT NULL,
  "variantId"    TEXT           NOT NULL,
  "productId"    TEXT           NOT NULL,
  "sellerId"     TEXT           NOT NULL,
  "quantity"     INTEGER        NOT NULL,
  "unitPrice"    DECIMAL(12, 2) NOT NULL,
  "optionName"   TEXT           NOT NULL,
  "optionValue"  TEXT           NOT NULL,
  "productTitle" TEXT           NOT NULL,
  "sku"          TEXT           NOT NULL,

  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_items_orderId_fkey"
    FOREIGN KEY ("orderId")
    REFERENCES orders."orders" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "order_items_orderId_idx"  ON orders."order_items" ("orderId");
-- sellerId 인덱스: FR-024 판매자 수주 목록 조회
CREATE INDEX "order_items_sellerId_idx" ON orders."order_items" ("sellerId");

-- -----------------------------------------------------------------------------
-- Step 8: orders."order_events" 테이블 생성 (FR-028)
-- append-only: 코드 레벨 규약 — DB 트리거 없음 (정적 테스트로 검증, SC-032)
-- orderId: 동일 스키마 FK
-- fromStatus/toStatus: String — enum 변경 시 이력 스키마 연동 부담 방지
-- actorId: SYSTEM 행위자 시 NULL 허용
-- -----------------------------------------------------------------------------
CREATE TABLE orders."order_events" (
  "id"         TEXT              NOT NULL,
  "orderId"    TEXT              NOT NULL,
  "fromStatus" TEXT,
  "toStatus"   TEXT              NOT NULL,
  "actorType"  orders."ActorType" NOT NULL,
  "actorId"    TEXT,
  "createdAt"  TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_events_orderId_fkey"
    FOREIGN KEY ("orderId")
    REFERENCES orders."orders" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "order_events_orderId_createdAt_idx"
  ON orders."order_events" ("orderId", "createdAt" DESC);

-- -----------------------------------------------------------------------------
-- Step 9: payments."payments" 테이블 생성 (FR-031, FR-035, ADR-006)
-- orderId @unique — cross-schema plain String (P-001), order당 결제 1건
-- userId — cross-schema plain String (P-001)
-- amount: Decimal(12,2) — P-005
-- idempotencyKey @unique: 클라이언트 UUID v4 멱등성 guard (FR-031/035, ADR-006)
-- failureReason: 결제 실패 사유 (FR-036)
-- -----------------------------------------------------------------------------
CREATE TABLE payments."payments" (
  "id"              TEXT                    NOT NULL,
  "orderId"         TEXT                    NOT NULL,
  "userId"          TEXT                    NOT NULL,
  "amount"          DECIMAL(12, 2)          NOT NULL,
  "status"          payments."PaymentStatus" NOT NULL DEFAULT 'pending',
  "idempotencyKey"  TEXT                    NOT NULL,
  "pgTransactionId" TEXT,
  "failureReason"   TEXT,
  "createdAt"       TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- orderId UNIQUE: order당 결제 1건 강제
CREATE UNIQUE INDEX "payments_orderId_key"
  ON payments."payments" ("orderId");

-- idempotencyKey UNIQUE: 멱등성 race guard (FR-031/035, ADR-006)
CREATE UNIQUE INDEX "payments_idempotencyKey_key"
  ON payments."payments" ("idempotencyKey");

-- -----------------------------------------------------------------------------
-- Step 10: payments."refunds" 테이블 생성 (FR-038, ADR-008)
-- paymentId: 동일 스키마 FK
-- amount: Decimal(12,2) — P-005
-- idempotencyKey @unique: 서버 생성 "refund:{orderId}" — 이중환불 guard (FR-038, ADR-008)
-- -----------------------------------------------------------------------------
CREATE TABLE payments."refunds" (
  "id"             TEXT           NOT NULL,
  "paymentId"      TEXT           NOT NULL,
  "amount"         DECIMAL(12, 2) NOT NULL,
  "idempotencyKey" TEXT           NOT NULL,
  "status"         TEXT           NOT NULL,
  "pgRefundId"     TEXT,
  "createdAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refunds_paymentId_fkey"
    FOREIGN KEY ("paymentId")
    REFERENCES payments."payments" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "refunds_paymentId_idx"
  ON payments."refunds" ("paymentId");

-- idempotencyKey UNIQUE: 이중환불 guard (FR-038, ADR-008)
CREATE UNIQUE INDEX "refunds_idempotencyKey_key"
  ON payments."refunds" ("idempotencyKey");

-- -----------------------------------------------------------------------------
-- Step 11: payments."payment_outbox" 테이블 생성 (FR-033, FR-037, NFR-008, ADR-007)
-- paymentId: 동일 스키마 FK
-- eventType: 'payment.completed' | 'payment.refunded'
-- payload JSONB: {orderId, ...} — OutboxRelay 처리에 필요한 컨텍스트
-- status: 'pending' | 'processed'
-- outbox 행은 결제/환불과 동일 트랜잭션 내 기록 (at-least-once 보장)
-- -----------------------------------------------------------------------------
CREATE TABLE payments."payment_outbox" (
  "id"          TEXT         NOT NULL,
  "paymentId"   TEXT         NOT NULL,
  "eventType"   TEXT         NOT NULL,
  "payload"     JSONB        NOT NULL,
  "status"      TEXT         NOT NULL DEFAULT 'pending',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "payment_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_outbox_paymentId_fkey"
    FOREIGN KEY ("paymentId")
    REFERENCES payments."payments" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- OutboxRelay pending 행 폴링 인덱스 (ADR-007): WHERE status='pending' ORDER BY createdAt ASC
CREATE INDEX "payment_outbox_status_createdAt_idx"
  ON payments."payment_outbox" ("status", "createdAt" ASC);

CREATE INDEX "payment_outbox_paymentId_idx"
  ON payments."payment_outbox" ("paymentId");

COMMIT;


-- =============================================================================
-- DOWN
-- =============================================================================
-- 주의: products."InventoryLogType" 에서 'RESTORE' 값을 제거하는 과정은
--       PostgreSQL 이 직접 지원하지 않으므로 enum 재생성 방식을 사용한다.
--       inventory_logs 테이블에 type = 'RESTORE' 인 행이 존재하면 삭제된다.
--       실행 전 해당 행 존재 여부를 반드시 확인할 것.
--
-- 실행 전 확인:
--   SELECT count(*) FROM products.inventory_logs WHERE type = 'RESTORE';
--   → 0 이어야 안전. 0이 아니면 백업 후 진행하거나 롤백을 포기한다.
-- =============================================================================

BEGIN;

-- 신규 테이블 DROP (의존 역순)
DROP TABLE IF EXISTS payments."payment_outbox";
DROP TABLE IF EXISTS payments."refunds";
DROP TABLE IF EXISTS payments."payments";
DROP TABLE IF EXISTS orders."order_events";
DROP TABLE IF EXISTS orders."order_items";
DROP TABLE IF EXISTS orders."orders";
DROP TABLE IF EXISTS commerce."carts";

-- 신규 enum DROP
DROP TYPE IF EXISTS payments."PaymentStatus";
DROP TYPE IF EXISTS orders."ActorType";
DROP TYPE IF EXISTS orders."OrderStatus";

COMMIT;

-- InventoryLogType.RESTORE 제거 (enum 재생성 — 트랜잭션 외부)
-- Step 1: RESTORE 타입 이력 행 삭제 (데이터 손실 — 실행 전 확인 필수)
DELETE FROM products.inventory_logs WHERE type = 'RESTORE';

-- Step 2: column 타입을 TEXT 로 임시 전환
ALTER TABLE products.inventory_logs
  ALTER COLUMN type TYPE TEXT;

-- Step 3: 기존 enum DROP
DROP TYPE products."InventoryLogType";

-- Step 4: RESTORE 제외하고 enum 재생성
CREATE TYPE products."InventoryLogType" AS ENUM (
  'STOCK_IN',
  'DECREASE',
  'INIT'
);

-- Step 5: column 타입 복원
ALTER TABLE products.inventory_logs
  ALTER COLUMN type TYPE products."InventoryLogType"
  USING type::products."InventoryLogType";
