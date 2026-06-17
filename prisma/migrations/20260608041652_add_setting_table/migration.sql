-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "cardFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);
