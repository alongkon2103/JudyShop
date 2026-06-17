/*
  Warnings:

  - You are about to alter the column `amount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `priceTHB` on the `Plan` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `priceUSD` on the `Plan` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "usdAuto" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "priceTHB" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "priceUSD" SET DATA TYPE DECIMAL(10,2);
