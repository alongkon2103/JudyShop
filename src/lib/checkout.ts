/**
 * Checkout — Stripe Session creation + whitelist grant logic.
 * Server-only.
 */
import { db } from "./db";
import { stripe } from "./stripe";
import { env } from "./env";
import { getSettings, priceBreakdown } from "./settings";
import { normalizeRobloxUsername } from "./roblox";
import type { PaymentMethod } from "@prisma/client";

export type CheckoutInput = {
  productId: string;
  planId: string;
  /** Roblox username — bound to the Whitelist row that gets created. */
  username: string;
  /** UI selection — maps to Stripe's allowed payment methods. */
  method: "promptpay" | "card";
};

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Session creation ─────────────────────────────────────────

export async function createCheckoutSession(input: CheckoutInput): Promise<{ url: string; id: string }> {
  const username = normalizeRobloxUsername(input.username);
  if (!username) throw new Error("Roblox username is required.");
  if (username.length > 100) throw new Error("Username too long.");

  const plan = await db.plan.findUnique({
    where: { id: input.planId },
    include: { product: true },
  });
  if (!plan)                                throw new Error("Plan not found.");
  if (plan.productId !== input.productId)   throw new Error("Plan does not match product.");
  if (!plan.isActive)                       throw new Error("Plan is no longer available.");
  if (!plan.product.isActive)               throw new Error("Product is not available.");
  if (plan.product.comingSoon)              throw new Error("Product is not available yet.");

  // Apply card-method surcharge based on site settings.
  const settings = await getSettings();
  const subtotal = Number(plan.priceTHB);
  const breakdown = priceBreakdown(subtotal, input.method, settings.cardFeePercent);

  // THB — Stripe supports it for both card and PromptPay. Smallest unit: satang.
  const amountSatang = Math.round(breakdown.total * 100);
  if (amountSatang < 1) throw new Error("Invalid plan price.");

  const description =
    (plan.isLifetime ? "Lifetime access" : `${plan.durationDays ?? 0} days access`) +
    (breakdown.fee > 0 ? ` · incl. card fee ${breakdown.feePercent}%` : "");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: input.method === "promptpay" ? ["promptpay"] : ["card"],
    line_items: [
      {
        price_data: {
          currency: "thb",
          unit_amount: amountSatang,
          product_data: {
            name: `${plan.product.nameEn} — ${plan.labelEn}`,
            description,
            metadata: {
              productId: plan.productId,
              planId: plan.id,
            },
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      productId: plan.productId,
      planId: plan.id,
      username,
    },
    success_url: `${env.SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${env.SITE_URL}/cancel?session_id={CHECKOUT_SESSION_ID}`,
    locale: "th",
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return { url: session.url, id: session.id };
}

// ── Webhook fulfilment ───────────────────────────────────────

/**
 * Idempotent: re-running with the same Stripe sessionId is safe.
 * - Creates/updates Order keyed by stripeSessionId
 * - Upserts Whitelist on (productId, username):
 *     - lifetime plan      → isLifetime=true, expireDate=null
 *     - duration plan      → extend from current expiry if still active, else from now
 *     - existing lifetime  → preserved (never downgrade)
 */
export async function fulfilCheckout(args: {
  stripeSessionId: string;
  stripePaymentId: string | null;
  metadata: { productId?: string; planId?: string; username?: string };
  amountTotal: number | null;
  currency: string | null;
  paymentMethod: PaymentMethod;
  /** Customer email Stripe captured at checkout, used to label the
   *  Whitelist row (e.g. "Stripe: foo@bar.com") so admins can match
   *  whitelist entries back to a buyer in support tickets. */
  customerEmail?: string | null;
}): Promise<void> {
  const { productId, planId, username } = args.metadata;
  if (!productId || !planId || !username) {
    throw new Error("Stripe metadata missing productId/planId/username");
  }
  const stripeLabel = args.customerEmail ? `Stripe: ${args.customerEmail}` : null;

  const plan = await db.plan.findUnique({
    where: { id: planId },
    include: { product: true },
  });
  if (!plan) throw new Error(`Plan ${planId} not found`);

  // --- 1. Compute new expiry / lifetime ------------------------------
  // We compute BEFORE the transaction so the transaction body is fast
  // (just the writes). The lifetime+expiry calculation depends on the
  // current Whitelist row, so we read it here even though we re-upsert
  // inside the txn — the upsert is the source of truth.
  const existing = await db.whitelist.findUnique({
    where: { productId_username: { productId, username } },
  });
  const now = new Date();

  let nextExpireDate: Date | null;
  let nextIsLifetime: boolean;

  if (existing?.isLifetime || plan.isLifetime) {
    // Once lifetime, always lifetime.
    nextIsLifetime  = true;
    nextExpireDate  = null;
  } else {
    nextIsLifetime  = false;
    const days = plan.durationDays ?? 0;
    const startFrom =
      existing?.expireDate && existing.expireDate > now ? existing.expireDate : now;
    nextExpireDate = new Date(startFrom.getTime() + days * DAY_MS);
  }

  // --- 2. Atomic Order + Whitelist write -----------------------------
  // Wrap both writes in a single transaction so we never end up in a
  // half-fulfilled state (Order=PAID but no Whitelist row, or vice
  // versa) if the DB dies mid-flight. Both upserts are idempotent on
  // their unique keys, so Stripe webhook retries continue to be safe.
  //
  // Label policy: on a Stripe purchase we overwrite any prior label
  // with the buyer's email. If Stripe didn't return an email, fall back
  // to keeping the existing label.
  await db.$transaction(async (tx) => {
    const order = await tx.order.upsert({
      where: { stripeSessionId: args.stripeSessionId },
      update: {
        status: "PAID",
        stripePaymentId: args.stripePaymentId,
        amount: (args.amountTotal ?? 0) / 100,
      },
      create: {
        productId,
        planId,
        username,
        amount: (args.amountTotal ?? 0) / 100,
        currency: (args.currency ?? "thb").toUpperCase(),
        paymentMethod: args.paymentMethod,
        status: "PAID",
        stripeSessionId: args.stripeSessionId,
        stripePaymentId: args.stripePaymentId,
      },
    });

    await tx.whitelist.upsert({
      where: { productId_username: { productId, username } },
      update: {
        expireDate: nextExpireDate,
        isLifetime: nextIsLifetime,
        source: "STRIPE",
        addedBy: "stripe",
        orderId: order.id,
        ...(stripeLabel ? { label: stripeLabel } : {}),
      },
      create: {
        productId,
        username,
        expireDate: nextExpireDate,
        isLifetime: nextIsLifetime,
        source: "STRIPE",
        addedBy: "stripe",
        orderId: order.id,
        label: stripeLabel,
      },
    });
  });
}
