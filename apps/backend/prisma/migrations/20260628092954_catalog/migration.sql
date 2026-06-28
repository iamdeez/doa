-- CreateEnum
CREATE TYPE "users"."SellerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "products"."ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OUT_OF_STOCK', 'INACTIVE');

-- CreateEnum
CREATE TYPE "products"."InventoryLogType" AS ENUM ('STOCK_IN', 'DECREASE', 'INIT');

-- DropIndex
DROP INDEX "users"."refresh_tokens_userId_idx";

-- AlterTable
ALTER TABLE "users"."users" ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "users"."sellers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessNumber" TEXT NOT NULL,
    "representativeName" TEXT NOT NULL,
    "contactPhone" TEXT,
    "businessAddress" TEXT,
    "status" "users"."SellerStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."wishlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."product_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products"."categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products"."products" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "status" "products"."ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products"."product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products"."variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "optionName" TEXT NOT NULL,
    "optionValue" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products"."inventory" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products"."inventory_logs" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "products"."InventoryLogType" NOT NULL,
    "delta" INTEGER NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sellers_userId_key" ON "users"."sellers"("userId");

-- CreateIndex
CREATE INDEX "addresses_userId_idx" ON "users"."addresses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_userId_productId_key" ON "users"."wishlists"("userId", "productId");

-- CreateIndex
CREATE INDEX "product_views_userId_viewedAt_idx" ON "users"."product_views"("userId", "viewedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "product_views_userId_productId_key" ON "users"."product_views"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "products"."categories"("slug");

-- CreateIndex
CREATE INDEX "products_status_createdAt_id_idx" ON "products"."products"("status", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "product_images_productId_idx" ON "products"."product_images"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "variants_sku_key" ON "products"."variants"("sku");

-- CreateIndex
CREATE INDEX "variants_productId_idx" ON "products"."variants"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_variantId_key" ON "products"."inventory"("variantId");

-- CreateIndex
CREATE INDEX "inventory_productId_idx" ON "products"."inventory"("productId");

-- CreateIndex
CREATE INDEX "inventory_logs_variantId_createdAt_idx" ON "products"."inventory_logs"("variantId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "users"."sellers" ADD CONSTRAINT "sellers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."wishlists" ADD CONSTRAINT "wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."product_views" ADD CONSTRAINT "product_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products"."products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "products"."categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products"."product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products"."variants" ADD CONSTRAINT "variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products"."inventory" ADD CONSTRAINT "inventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "products"."variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products"."inventory" ADD CONSTRAINT "inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
