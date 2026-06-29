-- Migration: 004_commerce_coupon_review
-- Spec   : v1.0.0/004-review-coupon
-- Schema : commerce
-- 기존 003 마이그레이션(commerce.carts) 이후 적용

-- ============================================================
-- Up Migration
-- ============================================================

-- CreateEnum: 쿠폰 발급자 유형 (ADR-010)
CREATE TYPE "commerce"."CouponIssuerType" AS ENUM ('ADMIN', 'SELLER');

-- CreateEnum: 쿠폰 할인 유형 (FR-001)
CREATE TYPE "commerce"."CouponType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum: user_coupon 상태 (FR-005, ADR-002)
CREATE TYPE "commerce"."UserCouponStatus" AS ENUM ('unused', 'used', 'expired');

-- CreateTable: 쿠폰 마스터
-- issuedCount: 발급 한도 조건부 increment 가드 — $executeRaw 전용 (ADR-004)
-- 금전 필드: DECIMAL(12,2) 전용 (P-005, NFR-001)
CREATE TABLE "commerce"."coupons" (
    "id"                TEXT            NOT NULL,
    "issuerType"        "commerce"."CouponIssuerType" NOT NULL,
    "issuerId"          TEXT            NOT NULL,
    "type"              "commerce"."CouponType" NOT NULL,
    "discountValue"     DECIMAL(12,2)   NOT NULL,
    "maxDiscountAmount" DECIMAL(12,2),
    "minOrderAmount"    DECIMAL(12,2),
    "expiresAt"         TIMESTAMP(3)    NOT NULL,
    "totalQuantity"     INTEGER,
    "issuedCount"       INTEGER         NOT NULL DEFAULT 0,
    "description"       TEXT,
    "createdAt"         TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 쿠폰 발급 인스턴스 (고객 보유 쿠폰)
-- userId, usedOrderId: cross-schema plain String (P-001) — FK 미선언
-- couponId: 동일 commerce 스키마 — FK 정식 선언
CREATE TABLE "commerce"."user_coupons" (
    "id"          TEXT            NOT NULL,
    "couponId"    TEXT            NOT NULL,
    "userId"      TEXT            NOT NULL,
    "status"      "commerce"."UserCouponStatus" NOT NULL DEFAULT 'unused',
    "usedOrderId" TEXT,
    "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 리뷰
-- orderItemId: cross-schema plain String (P-001). UNIQUE 으로 1 orderItem 1 리뷰 DB 보장 (ADR-009, FR-021c)
-- orderId, userId, productId, sellerId: cross-schema plain String (P-001) — FK 미선언
CREATE TABLE "commerce"."reviews" (
    "id"          TEXT            NOT NULL,
    "orderItemId" TEXT            NOT NULL,
    "orderId"     TEXT            NOT NULL,
    "userId"      TEXT            NOT NULL,
    "productId"   TEXT            NOT NULL,
    "sellerId"    TEXT            NOT NULL,
    "rating"      INTEGER         NOT NULL,
    "content"     TEXT            NOT NULL,
    "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)    NOT NULL,
    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: user_coupons → coupons (동일 commerce 스키마 정식 FK)
ALTER TABLE "commerce"."user_coupons"
    ADD CONSTRAINT "user_coupons_couponId_fkey"
    FOREIGN KEY ("couponId")
    REFERENCES "commerce"."coupons"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddUniqueConstraint: 중복 리뷰 방지 (ADR-009, P2002 → 409)
ALTER TABLE "commerce"."reviews"
    ADD CONSTRAINT "reviews_orderItemId_key" UNIQUE ("orderItemId");

-- CreateIndex: 판매자 쿠폰 목록 조회 + 발급자 소유권 검증 (FR-006, FR-004)
CREATE INDEX "coupons_issuerType_issuerId_idx"
    ON "commerce"."coupons"("issuerType", "issuerId");

-- CreateIndex: 내 쿠폰 조회 status 필터 (FR-005)
CREATE INDEX "user_coupons_userId_status_idx"
    ON "commerce"."user_coupons"("userId", "status");

-- CreateIndex: 주문 취소 시 쿠폰 복원 조회 (FR-016)
CREATE INDEX "user_coupons_usedOrderId_idx"
    ON "commerce"."user_coupons"("usedOrderId");

-- CreateIndex: 상품별 리뷰 cursor 페이지네이션 최신순 (FR-025)
CREATE INDEX "reviews_productId_createdAt_id_idx"
    ON "commerce"."reviews"("productId", "createdAt" DESC, "id" DESC);

-- CreateIndex: 내 리뷰 cursor 페이지네이션 (FR-026)
CREATE INDEX "reviews_userId_createdAt_id_idx"
    ON "commerce"."reviews"("userId", "createdAt" DESC, "id" DESC);


-- ============================================================
-- Down Migration
-- ============================================================

-- DropIndex
DROP INDEX IF EXISTS "commerce"."reviews_userId_createdAt_id_idx";
DROP INDEX IF EXISTS "commerce"."reviews_productId_createdAt_id_idx";
DROP INDEX IF EXISTS "commerce"."user_coupons_usedOrderId_idx";
DROP INDEX IF EXISTS "commerce"."user_coupons_userId_status_idx";
DROP INDEX IF EXISTS "commerce"."coupons_issuerType_issuerId_idx";

-- DropUniqueConstraint
ALTER TABLE "commerce"."reviews"
    DROP CONSTRAINT IF EXISTS "reviews_orderItemId_key";

-- DropForeignKey
ALTER TABLE "commerce"."user_coupons"
    DROP CONSTRAINT IF EXISTS "user_coupons_couponId_fkey";

-- DropTable (참조 테이블 먼저 DROP)
DROP TABLE IF EXISTS "commerce"."reviews";
DROP TABLE IF EXISTS "commerce"."user_coupons";
DROP TABLE IF EXISTS "commerce"."coupons";

-- DropEnum
DROP TYPE IF EXISTS "commerce"."UserCouponStatus";
DROP TYPE IF EXISTS "commerce"."CouponType";
DROP TYPE IF EXISTS "commerce"."CouponIssuerType";
