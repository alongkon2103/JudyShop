-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPartner" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "sharePercent" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Partner_name_idx" ON "Partner"("name");

-- CreateIndex
CREATE INDEX "ProductPartner_partnerId_idx" ON "ProductPartner"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPartner_productId_partnerId_key" ON "ProductPartner"("productId", "partnerId");

-- AddForeignKey
-- onDelete CASCADE for product: removing a product cleans up its share rows
ALTER TABLE "ProductPartner"
  ADD CONSTRAINT "ProductPartner_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- onDelete RESTRICT for partner: deleting a partner with active shares
-- must be blocked at the DB level — admin has to remove allocations first.
ALTER TABLE "ProductPartner"
  ADD CONSTRAINT "ProductPartner_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
