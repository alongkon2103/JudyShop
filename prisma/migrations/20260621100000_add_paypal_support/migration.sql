-- Add PAYPAL to the PaymentMethod and WhitelistSource enums, and a
-- paypalFeePercent column to Setting. All changes are additive — no
-- existing rows are touched.

-- ── 1. PaymentMethod enum ────────────────────────────────────
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PAYPAL';

-- ── 2. WhitelistSource enum ──────────────────────────────────
ALTER TYPE "WhitelistSource" ADD VALUE IF NOT EXISTS 'PAYPAL';

-- ── 3. Setting.paypalFeePercent ──────────────────────────────
-- Decimal(5, 2) matches the existing cardFeePercent column.
-- Default 0 so the singleton row (already present) gets a sane value
-- automatically without a follow-up UPDATE.
ALTER TABLE "Setting"
  ADD COLUMN "paypalFeePercent" DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- ── 4. Order.paypalOrderId / paypalCaptureId ─────────────────
-- Nullable so existing Stripe orders aren't affected. Unique index
-- on paypalOrderId mirrors stripeSessionId — used as the dedup /
-- idempotency key in fulfilPaypalCheckout.
ALTER TABLE "Order"
  ADD COLUMN "paypalOrderId"   TEXT,
  ADD COLUMN "paypalCaptureId" TEXT;

CREATE UNIQUE INDEX "Order_paypalOrderId_key" ON "Order"("paypalOrderId");
