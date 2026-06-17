/**
 * Trial fulfilment — the "Try N minutes" flow.
 *
 * Server-only. Mirrors `fulfilCheckout` (paid) but with three twists:
 *
 *   1. Source = TRIAL — easy to distinguish in admin views.
 *   2. Rate-limit: 1 trial per (productId, username) per 24h, tracked
 *      in the `TrialUsage` table so history survives even after the
 *      customer later purchases and the Whitelist row is rewritten.
 *   3. Defensive on top of paid access: if the customer already has a
 *      lifetime row, or an expireDate that's already further than the
 *      trial would push it, we DON'T overwrite — better to tell them
 *      "you already have access" than to clobber a paid Whitelist with
 *      a shorter trial entry.
 *
 * The Whitelist upsert and TrialUsage insert run inside a single
 * Prisma transaction so we can't end up with a half-recorded trial.
 */
import { db } from "./db";

const MIN_TRIAL_MINUTES = 1;
const MAX_TRIAL_MINUTES = 60;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

export type StartTrialResult =
  | { ok: true; expiresAt: string; minutes: number }
  | { ok: false; reason:
        | "product_not_found"
        | "product_inactive"
        | "trial_disabled"
        | "rate_limited"          // already used a trial in the last 24h
        | "already_active"        // existing lifetime or longer paid access
        | "invalid_username"
    };

export async function startTrial(args: {
  productId: string;
  username: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<StartTrialResult> {
  const username = args.username.trim();
  if (!username) return { ok: false, reason: "invalid_username" };

  const product = await db.product.findUnique({
    where: { id: args.productId },
    select: {
      id: true,
      isActive: true,
      trialEnabled: true,
      trialMinutes: true,
    },
  });
  if (!product) return { ok: false, reason: "product_not_found" };
  if (!product.isActive) return { ok: false, reason: "product_inactive" };
  if (!product.trialEnabled) return { ok: false, reason: "trial_disabled" };

  const minutes = clampTrialMinutes(product.trialMinutes);
  const now = new Date();
  const newExpiry = new Date(now.getTime() + minutes * 60 * 1000);

  // ── 1. Rate-limit: any TrialUsage for this (productId, username)
  //       within the last 24h blocks a fresh trial.
  const cutoff = new Date(now.getTime() - RATE_WINDOW_MS);
  const recent = await db.trialUsage.findFirst({
    where: {
      productId: product.id,
      username:  { equals: username, mode: "insensitive" },
      startedAt: { gte: cutoff },
    },
    orderBy: { startedAt: "desc" },
  });
  if (recent) return { ok: false, reason: "rate_limited" };

  // ── 2. Don't downgrade an existing paid/lifetime whitelist.
  const existing = await db.whitelist.findUnique({
    where: { productId_username: { productId: product.id, username } },
  });
  if (existing) {
    if (existing.isLifetime) return { ok: false, reason: "already_active" };
    if (existing.expireDate && existing.expireDate > newExpiry) {
      return { ok: false, reason: "already_active" };
    }
  }

  // ── 3. Upsert whitelist + record trial usage, atomically.
  await db.$transaction([
    db.whitelist.upsert({
      where: { productId_username: { productId: product.id, username } },
      create: {
        productId:  product.id,
        username,
        expireDate: newExpiry,
        isLifetime: false,
        source:     "TRIAL",
        addedBy:    "trial",
      },
      update: {
        expireDate: newExpiry,
        isLifetime: false,
        source:     "TRIAL",
        addedBy:    "trial",
      },
    }),
    db.trialUsage.create({
      data: {
        productId: product.id,
        username,
        ip:        args.ip ?? null,
        userAgent: args.userAgent ?? null,
        startedAt: now,
        expiresAt: newExpiry,
      },
    }),
  ]);

  return { ok: true, expiresAt: newExpiry.toISOString(), minutes };
}

/** Clamp the admin-supplied trial minutes to a sane range. */
export function clampTrialMinutes(n: number): number {
  if (!Number.isFinite(n)) return 10;
  return Math.min(MAX_TRIAL_MINUTES, Math.max(MIN_TRIAL_MINUTES, Math.round(n)));
}
