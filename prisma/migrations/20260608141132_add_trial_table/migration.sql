-- AlterEnum
ALTER TYPE "WhitelistSource" ADD VALUE 'TRIAL';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "trialEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trialMinutes" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "TrialUsage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrialUsage_productId_username_startedAt_idx" ON "TrialUsage"("productId", "username", "startedAt");

-- CreateIndex
CREATE INDEX "TrialUsage_username_startedAt_idx" ON "TrialUsage"("username", "startedAt");

-- AddForeignKey
ALTER TABLE "TrialUsage" ADD CONSTRAINT "TrialUsage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
