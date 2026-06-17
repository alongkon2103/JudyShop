/**
 * Site-wide settings (singleton). Currently:
 *   - cardFeePercent: surcharge added to cart total when paying by card
 */
import { Prisma } from "@prisma/client";
import { db } from "./db";

const SETTINGS_ID = "singleton" as const;

export type SiteSettings = {
  cardFeePercent: number;
};

export async function getSettings(): Promise<SiteSettings> {
  const row = await db.setting.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID, cardFeePercent: new Prisma.Decimal(0) },
  });
  return { cardFeePercent: Number(row.cardFeePercent) };
}

export async function updateSettings(input: {
  cardFeePercent: number;
  updatedBy?: string | null;
}): Promise<SiteSettings> {
  const safePercent = Math.max(0, Math.min(100, input.cardFeePercent));
  const row = await db.setting.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      cardFeePercent: new Prisma.Decimal(safePercent.toFixed(2)),
      updatedBy: input.updatedBy ?? null,
    },
    update: {
      cardFeePercent: new Prisma.Decimal(safePercent.toFixed(2)),
      updatedBy: input.updatedBy ?? null,
    },
  });
  return { cardFeePercent: Number(row.cardFeePercent) };
}

// ── Pricing helpers ──────────────────────────────────────────

export type PriceBreakdown = {
  subtotal: number;
  feePercent: number;
  fee: number;
  total: number;
};

/**
 * Compute total with surcharge.
 *   - PromptPay: no fee
 *   - Card: subtotal * (1 + feePercent/100), rounded to 2 decimals
 */
export function priceBreakdown(
  subtotal: number,
  method: "promptpay" | "card",
  cardFeePercent: number,
): PriceBreakdown {
  if (method === "card" && cardFeePercent > 0) {
    const fee = Math.round(subtotal * cardFeePercent) / 100;
    return {
      subtotal,
      feePercent: cardFeePercent,
      fee,
      total: Math.round((subtotal + fee) * 100) / 100,
    };
  }
  return { subtotal, feePercent: 0, fee: 0, total: subtotal };
}
