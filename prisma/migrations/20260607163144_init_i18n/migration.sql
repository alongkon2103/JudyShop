/*
  Warnings:

  - You are about to drop the column `message` on the `Announcement` table. All the data in the column will be lost.
  - You are about to drop the column `alt` on the `GiftOverlay` table. All the data in the column will be lost.
  - You are about to drop the column `giftName` on the `GiftOverlay` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Preset` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Preset` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `shortDescription` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `shortName` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `alt` on the `ProductImage` table. All the data in the column will be lost.
  - Added the required column `messageEn` to the `Announcement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `messageTh` to the `Announcement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `giftNameEn` to the `GiftOverlay` table without a default value. This is not possible if the table is not empty.
  - Added the required column `giftNameTh` to the `GiftOverlay` table without a default value. This is not possible if the table is not empty.
  - Added the required column `labelEn` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `labelTh` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameEn` to the `Preset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameTh` to the `Preset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `descriptionEn` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `descriptionTh` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameEn` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameTh` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Announcement" DROP COLUMN "message",
ADD COLUMN     "messageEn" TEXT NOT NULL,
ADD COLUMN     "messageTh" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "GiftOverlay" DROP COLUMN "alt",
DROP COLUMN "giftName",
ADD COLUMN     "altEn" TEXT,
ADD COLUMN     "altTh" TEXT,
ADD COLUMN     "giftNameEn" TEXT NOT NULL,
ADD COLUMN     "giftNameTh" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "label",
ADD COLUMN     "labelEn" TEXT NOT NULL,
ADD COLUMN     "labelTh" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Preset" DROP COLUMN "description",
DROP COLUMN "name",
ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "descriptionTh" TEXT,
ADD COLUMN     "nameEn" TEXT NOT NULL,
ADD COLUMN     "nameTh" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "description",
DROP COLUMN "name",
DROP COLUMN "shortDescription",
DROP COLUMN "shortName",
ADD COLUMN     "descriptionEn" TEXT NOT NULL,
ADD COLUMN     "descriptionTh" TEXT NOT NULL,
ADD COLUMN     "nameEn" TEXT NOT NULL,
ADD COLUMN     "nameTh" TEXT NOT NULL,
ADD COLUMN     "shortDescriptionEn" TEXT,
ADD COLUMN     "shortDescriptionTh" TEXT,
ADD COLUMN     "shortNameEn" TEXT,
ADD COLUMN     "shortNameTh" TEXT;

-- AlterTable
ALTER TABLE "ProductImage" DROP COLUMN "alt",
ADD COLUMN     "altEn" TEXT,
ADD COLUMN     "altTh" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
