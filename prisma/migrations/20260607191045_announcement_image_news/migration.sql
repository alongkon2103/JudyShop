-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('UPDATE', 'ANNOUNCE', 'EVENT', 'MAINTENANCE');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "imageUrl" TEXT,
ALTER COLUMN "messageEn" DROP NOT NULL,
ALTER COLUMN "messageTh" DROP NOT NULL;

-- CreateTable
CREATE TABLE "News" (
    "id" TEXT NOT NULL,
    "category" "NewsCategory" NOT NULL DEFAULT 'ANNOUNCE',
    "titleEn" TEXT NOT NULL,
    "titleTh" TEXT NOT NULL,
    "excerptEn" TEXT,
    "excerptTh" TEXT,
    "imageUrl" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "News_isPublished_publishedAt_idx" ON "News"("isPublished", "publishedAt");
