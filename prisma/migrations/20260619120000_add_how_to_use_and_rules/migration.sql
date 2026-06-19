-- Add rules content to the singleton Setting row.
ALTER TABLE "Setting" ADD COLUMN "rulesContentEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Setting" ADD COLUMN "rulesContentTh" TEXT NOT NULL DEFAULT '';

-- New table — admin-managed tutorial videos (YouTube only).
CREATE TABLE "HowToUseVideo" (
  "id"            TEXT NOT NULL,
  "titleEn"       TEXT NOT NULL,
  "titleTh"       TEXT NOT NULL,
  "descriptionEn" TEXT,
  "descriptionTh" TEXT,
  "youtubeUrl"    TEXT NOT NULL,
  "videoId"       TEXT NOT NULL,
  "displayOrder"  INTEGER NOT NULL DEFAULT 0,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HowToUseVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HowToUseVideo_isActive_displayOrder_idx"
  ON "HowToUseVideo"("isActive", "displayOrder");
