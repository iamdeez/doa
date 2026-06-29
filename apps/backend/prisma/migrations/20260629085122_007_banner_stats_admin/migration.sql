-- CreateEnum
CREATE TYPE "admin"."BannerPosition" AS ENUM ('MAIN_TOP', 'MAIN_MIDDLE', 'MAIN_BOTTOM', 'SIDEBAR');

-- CreateTable
CREATE TABLE "admin"."banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "position" "admin"."BannerPosition" NOT NULL DEFAULT 'MAIN_TOP',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "banners_isActive_position_sortOrder_idx" ON "admin"."banners"("isActive", "position", "sortOrder");
