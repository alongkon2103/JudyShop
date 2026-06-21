-- Kill switches per payment gateway. All default to TRUE so existing
-- behaviour is preserved on upgrade (no checkout disruption).

ALTER TABLE "Setting"
  ADD COLUMN "promptpayEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cardEnabled"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "paypalEnabled"    BOOLEAN NOT NULL DEFAULT true;
