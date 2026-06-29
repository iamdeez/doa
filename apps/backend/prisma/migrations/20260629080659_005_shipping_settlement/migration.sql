-- CreateEnum
CREATE TYPE "commerce"."CouponIssuerType" AS ENUM ('ADMIN', 'SELLER');

-- CreateEnum
CREATE TYPE "commerce"."CouponType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "commerce"."UserCouponStatus" AS ENUM ('unused', 'used', 'expired');

-- CreateEnum
CREATE TYPE "orders"."ShipmentStatus" AS ENUM ('preparing', 'shipped', 'in_transit', 'delivered');

-- CreateEnum
CREATE TYPE "settlements"."SettlementStatus" AS ENUM ('pending', 'completed');

-- CreateTable
CREATE TABLE "commerce"."coupons" (
    "id" TEXT NOT NULL,
    "issuerType" "commerce"."CouponIssuerType" NOT NULL,
    "issuerId" TEXT NOT NULL,
    "type" "commerce"."CouponType" NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "maxDiscountAmount" DECIMAL(12,2),
    "minOrderAmount" DECIMAL(12,2),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "totalQuantity" INTEGER,
    "issuedCount" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce"."user_coupons" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "commerce"."UserCouponStatus" NOT NULL DEFAULT 'unused',
    "usedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce"."reviews" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders"."shipments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "orders"."ShipmentStatus" NOT NULL DEFAULT 'preparing',
    "carrier" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders"."shipment_tracking" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "orders"."ShipmentStatus" NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements"."settlements" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalSales" DECIMAL(12,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL,
    "payoutAmount" DECIMAL(12,2) NOT NULL,
    "status" "settlements"."SettlementStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements"."settlement_items" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "saleAmount" DECIMAL(12,2) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "settlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupons_issuerType_issuerId_idx" ON "commerce"."coupons"("issuerType", "issuerId");

-- CreateIndex
CREATE INDEX "user_coupons_userId_status_idx" ON "commerce"."user_coupons"("userId", "status");

-- CreateIndex
CREATE INDEX "user_coupons_usedOrderId_idx" ON "commerce"."user_coupons"("usedOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_orderItemId_key" ON "commerce"."reviews"("orderItemId");

-- CreateIndex
CREATE INDEX "reviews_productId_createdAt_id_idx" ON "commerce"."reviews"("productId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "reviews_userId_createdAt_id_idx" ON "commerce"."reviews"("userId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "shipments_orderId_idx" ON "orders"."shipments"("orderId");

-- CreateIndex
CREATE INDEX "shipment_tracking_shipmentId_occurredAt_idx" ON "orders"."shipment_tracking"("shipmentId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "settlements_sellerId_createdAt_idx" ON "settlements"."settlements"("sellerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "settlement_items_settlementId_idx" ON "settlements"."settlement_items"("settlementId");

-- AddForeignKey
ALTER TABLE "commerce"."user_coupons" ADD CONSTRAINT "user_coupons_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "commerce"."coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders"."shipment_tracking" ADD CONSTRAINT "shipment_tracking_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "orders"."shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements"."settlement_items" ADD CONSTRAINT "settlement_items_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "settlements"."settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
