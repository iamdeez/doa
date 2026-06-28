-- Migration: 002 users 스키마 확장
-- Spec: 002-catalog
-- Prisma multiSchema — users 스키마에 sellers·addresses·wishlists·product_views 추가
--                      users.users 테이블에 name·phone nullable 컬럼 추가 (ADR-013)
-- 실행 방법: prisma migrate dev --name catalog (Prisma가 이 SQL을 생성·실행)
--            본 파일은 Prisma migrate dev가 생성하는 SQL의 설계 명세이자 롤백 쌍 참조용.

-- ============================================================
-- UP (정방향 마이그레이션)
-- ============================================================

-- 1. SellerStatus enum 생성 (users 스키마 스코프)
CREATE TYPE "users"."SellerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- 2. users.users 확장: name·phone nullable 컬럼 추가
--    기존 행에는 NULL 기본값 적용 → 기존 auth 로직 무영향 (additive)
ALTER TABLE "users"."users"
  ADD COLUMN IF NOT EXISTS "name"  TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- 3. sellers 테이블 생성
--    users.userId FK → users.users.id ON DELETE CASCADE
--    @@unique([userId]) — 사용자당 판매자 등록 1건 (SC-013)
CREATE TABLE "users"."sellers" (
  "id"                  TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"              TEXT        NOT NULL,
  "businessName"        TEXT        NOT NULL,
  "businessNumber"      TEXT        NOT NULL,
  "representativeName"  TEXT        NOT NULL,
  "contactPhone"        TEXT,
  "businessAddress"     TEXT,
  "status"              "users"."SellerStatus" NOT NULL DEFAULT 'PENDING',
  "rejectReason"        TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sellers_pkey"   PRIMARY KEY ("id"),
  CONSTRAINT "sellers_userId_key" UNIQUE ("userId"),
  CONSTRAINT "sellers_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "users"."users" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4. addresses 테이블 생성
--    userId FK → users.users.id ON DELETE CASCADE
CREATE TABLE "users"."addresses" (
  "id"            TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"        TEXT        NOT NULL,
  "recipientName" TEXT        NOT NULL,
  "phone"         TEXT        NOT NULL,
  "zipCode"       TEXT        NOT NULL,
  "address1"      TEXT        NOT NULL,
  "address2"      TEXT,
  "isDefault"     BOOLEAN     NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "addresses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "addresses_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "users"."users" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- addresses 인덱스: 사용자 배송지 목록 조회 최적화
CREATE INDEX IF NOT EXISTS "addresses_userId_idx"
  ON "users"."addresses" ("userId");

-- 5. wishlists 테이블 생성
--    userId FK → users.users.id ON DELETE CASCADE
--    productId: cross-schema 경계 → plain String, FK 미선언 (ADR-001, P-001)
--    @@unique([userId, productId]) — 찜 중복 방지 (SC-008)
CREATE TABLE "users"."wishlists" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"    TEXT        NOT NULL,
  "productId" TEXT        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wishlists_userId_productId_key" UNIQUE ("userId", "productId"),
  CONSTRAINT "wishlists_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "users"."users" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- 6. product_views 테이블 생성
--    userId FK → users.users.id ON DELETE CASCADE
--    productId: cross-schema 경계 → plain String, FK 미선언 (ADR-001, P-001)
--    @@unique([userId, productId]) — upsert 멱등성 (FR-009)
CREATE TABLE "users"."product_views" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"    TEXT        NOT NULL,
  "productId" TEXT        NOT NULL,
  "viewedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_views_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_views_userId_productId_key" UNIQUE ("userId", "productId"),
  CONSTRAINT "product_views_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "users"."users" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- product_views 인덱스: 최근 본 상품 최신순 조회 최적화 (FR-010, SC-012)
CREATE INDEX IF NOT EXISTS "product_views_userId_viewedAt_idx"
  ON "users"."product_views" ("userId", "viewedAt" DESC);


-- ============================================================
-- DOWN (롤백 마이그레이션)
-- ============================================================
-- 주의: 아래 구문은 롤백 시 실행. 운영 환경에서는 데이터 유실 발생.
--       롤백 전 반드시 데이터 백업 수행.
--
-- DROP TABLE "users"."product_views";
-- DROP TABLE "users"."wishlists";
-- DROP TABLE "users"."addresses";
-- DROP TABLE "users"."sellers";
-- ALTER TABLE "users"."users"
--   DROP COLUMN IF EXISTS "name",
--   DROP COLUMN IF EXISTS "phone";
-- DROP TYPE "users"."SellerStatus";
