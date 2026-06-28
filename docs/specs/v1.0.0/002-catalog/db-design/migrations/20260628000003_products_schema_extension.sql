-- Migration: 003 products 스키마 확장
-- Spec: 002-catalog
-- Prisma multiSchema — products 스키마에 categories·products·product_images·variants·inventory·inventory_logs 추가
-- 실행 방법: prisma migrate dev --name catalog (002와 동일 실행 — Prisma가 단일 마이그레이션으로 병합 가능)
--            본 파일은 Prisma migrate dev가 생성하는 SQL의 설계 명세이자 롤백 쌍 참조용.

-- ============================================================
-- UP (정방향 마이그레이션)
-- ============================================================

-- 1. enum 타입 생성 (products 스키마 스코프)

-- ProductStatus: 상품 상태 머신 (FR-021~024, SC-026~031)
CREATE TYPE "products"."ProductStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'OUT_OF_STOCK',
  'INACTIVE'
);

-- InventoryLogType: 재고 변동 유형 (FR-032, SC-043)
CREATE TYPE "products"."InventoryLogType" AS ENUM (
  'STOCK_IN',
  'DECREASE',
  'INIT'
);

-- 2. categories 테이블 생성
--    seed 데이터는 아래 INSERT 섹션에 포함 (ADR-010, GAP-001 해소)
CREATE TABLE "products"."categories" (
  "id"           TEXT    NOT NULL DEFAULT gen_random_uuid()::text,
  "name"         TEXT    NOT NULL,
  "slug"         TEXT    NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "categories_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "categories_slug_key" UNIQUE ("slug")
);

-- 3. products 테이블 생성
--    sellerId: users.sellers.id 참조 → cross-schema 경계, plain String, FK 미선언 (ADR-001, P-001)
--    categoryId: categories.id 참조 → 동일 스키마 FK ON DELETE RESTRICT (카테고리 삭제 방지)
--    price: Decimal(12,2) — 금전 필드 부동소수점 금지 (P-005, NFR-004, SC-050)
--    status: DEFAULT 'DRAFT' (FR-019, SC-022)
CREATE TABLE "products"."products" (
  "id"          TEXT           NOT NULL DEFAULT gen_random_uuid()::text,
  "sellerId"    TEXT           NOT NULL,
  "categoryId"  TEXT           NOT NULL,
  "title"       TEXT           NOT NULL,
  "description" TEXT,
  "price"       DECIMAL(12,2)  NOT NULL,
  "status"      "products"."ProductStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_categoryId_fkey"
    FOREIGN KEY ("categoryId")
    REFERENCES "products"."categories" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- products 복합 인덱스: cursor 페이지네이션 + status 필터 (NFR-001, ADR-007, SC-038·047)
-- orderBy: [{status}, {createdAt DESC}, {id DESC}] — 동률 행 누락 방지
CREATE INDEX IF NOT EXISTS "products_status_createdAt_id_idx"
  ON "products"."products" ("status", "createdAt" DESC, "id" DESC);

-- 4. product_images 테이블 생성
--    productId FK → products.products.id ON DELETE CASCADE
--    상품당 최대 10개 제한: 앱 레벨 count 검사 (ADR-011, SC-036). DB CHECK 미사용.
CREATE TABLE "products"."product_images" (
  "id"           TEXT    NOT NULL DEFAULT gen_random_uuid()::text,
  "productId"    TEXT    NOT NULL,
  "url"          TEXT    NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "product_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_images_productId_fkey"
    FOREIGN KEY ("productId")
    REFERENCES "products"."products" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- product_images 인덱스: 상품별 이미지 목록 조회 (FR-026)
CREATE INDEX IF NOT EXISTS "product_images_productId_idx"
  ON "products"."product_images" ("productId");

-- 5. variants 테이블 생성
--    productId FK → products.products.id ON DELETE CASCADE
--    sku: 전역 고유 (SKU 코드 중복 방지)
--    price: Decimal(12,2) — variant별 가격 (P-005, NFR-004)
--    stock 컬럼 없음 — 재고는 inventory 모듈 소유 (ADR-003)
CREATE TABLE "products"."variants" (
  "id"          TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "productId"   TEXT          NOT NULL,
  "optionName"  TEXT          NOT NULL,
  "optionValue" TEXT          NOT NULL,
  "sku"         TEXT          NOT NULL,
  "price"       DECIMAL(12,2) NOT NULL,

  CONSTRAINT "variants_pkey"    PRIMARY KEY ("id"),
  CONSTRAINT "variants_sku_key" UNIQUE ("sku"),
  CONSTRAINT "variants_productId_fkey"
    FOREIGN KEY ("productId")
    REFERENCES "products"."products" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- variants 인덱스: 상품별 variant 목록 조회 (FR-025)
CREATE INDEX IF NOT EXISTS "variants_productId_idx"
  ON "products"."variants" ("productId");

-- 6. inventory 테이블 생성
--    variantId FK → variants.id ON DELETE CASCADE (variant 삭제 시 재고 행도 삭제)
--    productId FK → products.id ON DELETE CASCADE (상품 삭제 시 재고 집계 행도 삭제)
--    quantity: DEFAULT 0, 음수 방지는 앱 레벨 조건부 감소로 보장 (ADR-005)
--    @@unique([variantId]) — variant당 재고 1행 (1:1 관계)
CREATE TABLE "products"."inventory" (
  "id"        TEXT    NOT NULL DEFAULT gen_random_uuid()::text,
  "variantId" TEXT    NOT NULL,
  "productId" TEXT    NOT NULL,
  "quantity"  INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "inventory_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "inventory_variantId_key" UNIQUE ("variantId"),
  CONSTRAINT "inventory_variantId_fkey"
    FOREIGN KEY ("variantId")
    REFERENCES "products"."variants" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inventory_productId_fkey"
    FOREIGN KEY ("productId")
    REFERENCES "products"."products" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- inventory 인덱스: 상품 총재고 합산 (sumQuantityByProduct, FR-023·024)
CREATE INDEX IF NOT EXISTS "inventory_productId_idx"
  ON "products"."inventory" ("productId");

-- 7. inventory_logs 테이블 생성 (append-only, FR-032, SC-043)
--    variantId·productId: plain String, FK 미선언
--    이유: append-only 이력 보존 우선. variant/product 삭제 후에도 이력은 영구 보존.
--         ON DELETE CASCADE 적용 시 이력 유실 → 의도적 FK 미선언.
--    UPDATE·DELETE 구문은 이 마이그레이션 및 모든 이후 마이그레이션에 미포함.
CREATE TABLE "products"."inventory_logs" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "variantId" TEXT        NOT NULL,
  "productId" TEXT        NOT NULL,
  "type"      "products"."InventoryLogType" NOT NULL,
  "delta"     INTEGER     NOT NULL,
  "orderId"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("id")
);

-- inventory_logs 인덱스: variant별 이력 조회 최적화 (FR-032)
CREATE INDEX IF NOT EXISTS "inventory_logs_variantId_createdAt_idx"
  ON "products"."inventory_logs" ("variantId", "createdAt" DESC);

-- ============================================================
-- 카테고리 seed 데이터 (ADR-010, GAP-001 해소)
-- 멱등 처리: ON CONFLICT (slug) DO NOTHING
-- ============================================================

INSERT INTO "products"."categories" ("id", "name", "slug", "displayOrder") VALUES
  (gen_random_uuid()::text, '전자기기',     'electronics',  1),
  (gen_random_uuid()::text, '패션·의류',    'fashion',       2),
  (gen_random_uuid()::text, '뷰티·화장품',  'beauty',        3),
  (gen_random_uuid()::text, '홈·리빙',      'home-living',   4),
  (gen_random_uuid()::text, '식품·먹거리',  'food',          5),
  (gen_random_uuid()::text, '스포츠·레저',  'sports',        6),
  (gen_random_uuid()::text, '도서·문구',    'books',         7),
  (gen_random_uuid()::text, '기타',         'etc',           8)
ON CONFLICT ("slug") DO NOTHING;


-- ============================================================
-- DOWN (롤백 마이그레이션)
-- ============================================================
-- 주의: 아래 구문은 롤백 시 실행. 운영 환경에서는 등록된 상품·재고·이력 전체 유실.
--       롤백 전 반드시 데이터 백업 수행.
--
-- DROP TABLE "products"."inventory_logs";
-- DROP TABLE "products"."inventory";
-- DROP TABLE "products"."variants";
-- DROP TABLE "products"."product_images";
-- DROP TABLE "products"."products";
-- DROP TABLE "products"."categories";
-- DROP TYPE "products"."InventoryLogType";
-- DROP TYPE "products"."ProductStatus";
