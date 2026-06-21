/**
 * Site-wide settings (singleton). Currently:
 *   - cardFeePercent:   surcharge added when paying by Stripe card
 *   - paypalFeePercent: surcharge added when paying by PayPal
 *   - <method>Enabled:  per-gateway kill switches (hide + reject)
 */
import { Prisma } from "@prisma/client";
import { db } from "./db";

const SETTINGS_ID = "singleton" as const;

export type SiteSettings = {
  cardFeePercent: number;
  paypalFeePercent: number;
  promptpayEnabled: boolean;
  cardEnabled: boolean;
  paypalEnabled: boolean;
};

export async function getSettings(): Promise<SiteSettings> {
  const row = await db.setting.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      cardFeePercent:   new Prisma.Decimal(0),
      paypalFeePercent: new Prisma.Decimal(0),
    },
  });
  return {
    cardFeePercent:   Number(row.cardFeePercent),
    paypalFeePercent: Number(row.paypalFeePercent),
    promptpayEnabled: row.promptpayEnabled,
    cardEnabled:      row.cardEnabled,
    paypalEnabled:    row.paypalEnabled,
  };
}

export async function updateSettings(input: {
  cardFeePercent: number;
  paypalFeePercent: number;
  promptpayEnabled: boolean;
  cardEnabled: boolean;
  paypalEnabled: boolean;
  updatedBy?: string | null;
}): Promise<SiteSettings> {
  const safeCard   = Math.max(0, Math.min(100, input.cardFeePercent));
  const safePaypal = Math.max(0, Math.min(100, input.paypalFeePercent));
  const row = await db.setting.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      cardFeePercent:   new Prisma.Decimal(safeCard.toFixed(2)),
      paypalFeePercent: new Prisma.Decimal(safePaypal.toFixed(2)),
      promptpayEnabled: input.promptpayEnabled,
      cardEnabled:      input.cardEnabled,
      paypalEnabled:    input.paypalEnabled,
      updatedBy: input.updatedBy ?? null,
    },
    update: {
      cardFeePercent:   new Prisma.Decimal(safeCard.toFixed(2)),
      paypalFeePercent: new Prisma.Decimal(safePaypal.toFixed(2)),
      promptpayEnabled: input.promptpayEnabled,
      cardEnabled:      input.cardEnabled,
      paypalEnabled:    input.paypalEnabled,
      updatedBy: input.updatedBy ?? null,
    },
  });
  return {
    cardFeePercent:   Number(row.cardFeePercent),
    paypalFeePercent: Number(row.paypalFeePercent),
    promptpayEnabled: row.promptpayEnabled,
    cardEnabled:      row.cardEnabled,
    paypalEnabled:    row.paypalEnabled,
  };
}

// ── Pricing helpers ──────────────────────────────────────────

export type PriceBreakdown = {
  subtotal: number;
  feePercent: number;
  fee: number;
  total: number;
};

export type PaymentMethodKey = "promptpay" | "card" | "paypal";

export type FeeConfig = {
  cardFeePercent: number;
  paypalFeePercent: number;
};

/**
 * Compute total with surcharge.
 *   - PromptPay: no fee
 *   - Card:      subtotal * (1 + cardFeePercent/100)
 *   - PayPal:    subtotal * (1 + paypalFeePercent/100)
 *
 * Rounding: fee is rounded to satang (2dp). Mirrors the Stripe satang
 * conversion so what the buyer sees in the UI equals what the gateway
 * actually charges.
 */
export function priceBreakdown(
  subtotal: number,
  method: PaymentMethodKey,
  fees: FeeConfig,
): PriceBreakdown {
  const pct =
    method === "card"   ? fees.cardFeePercent   :
    method === "paypal" ? fees.paypalFeePercent :
    0;
  if (pct > 0) {
    const fee = Math.round(subtotal * pct) / 100;
    return {
      subtotal,
      feePercent: pct,
      fee,
      total: Math.round((subtotal + fee) * 100) / 100,
    };
  }
  return { subtotal, feePercent: 0, fee: 0, total: subtotal };
}
