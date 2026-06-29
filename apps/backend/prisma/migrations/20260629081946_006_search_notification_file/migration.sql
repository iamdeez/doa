-- CreateEnum
CREATE TYPE "users"."NotificationType" AS ENUM ('ORDER_PLACED', 'ORDER_SHIPPED', 'SETTLEMENT_CREATED', 'REVIEW_RECEIVED');

-- CreateEnum
CREATE TYPE "files"."FilePurpose" AS ENUM ('PRODUCT_IMAGE', 'REVIEW_IMAGE', 'PROFILE');

-- CreateEnum
CREATE TYPE "files"."FileStatus" AS ENUM ('PENDING', 'UPLOADED');

-- CreateTable
CREATE TABLE "users"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "users"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files"."files" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "purpose" "files"."FilePurpose" NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "status" "files"."FileStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "users"."notifications"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "files_key_key" ON "files"."files"("key");

-- CreateIndex
CREATE INDEX "files_ownerId_createdAt_idx" ON "files"."files"("ownerId", "createdAt" DESC);
