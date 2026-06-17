import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { fulfilCheckout } from "@/lib/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe
 *
 * Stripe sends events here. We:
 *   1. Verify the signature against STRIPE_WEBHOOK_SECRET
 *   2. Reject already-processed events using the WebhookEvent table
 *      (Stripe replays the same event id for up to ~3 days on non-2xx
 *      responses — without this gate, fulfilment side-effects can
 *      run twice).
 *   3. On `checkout.session.completed` (paid) → upsert Order + Whitelist
 *   4. Record the event id so future replays return 200 OK no-ops.
 *
 * Locally:
 *   stripe listen --forward-to localhost:3000/api/webhooks/stripe
 *   (copy the `whsec_...` value into STRIPE_WEBHOOK_SECRET)
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  // Stripe needs the raw body bytes for signature verification.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe webhook] signature verify failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Dedup: drop replays that we've already fully processed. ──
  // If the row exists, the prior delivery succeeded — return 200 so
  // Stripe stops retrying. The row is only written AFTER processing
  // succeeds below, so a partial failure still gets re-delivered.
  try {
    const already = await db.webhookEvent.findUnique({ where: { id: event.id } });
    if (already) {
      console.log(`[stripe webhook] duplicate ${event.id} (${event.type}) — ack`);
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (err) {
    // DB outage during dedup check — process anyway and rely on
    // downstream upserts for idempotency. Better to risk a double-
    // upsert (which `fulfilCheckout` handles) than to drop the event.
    console.error("[stripe webhook] dedup lookup failed, proceeding:", err);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid") {
          // PromptPay / async methods can complete later via async_payment_succeeded.
          break;
        }
        await handleCheckoutPaid(session);
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutPaid(session);
        break;
      }
      case "checkout.session.async_payment_failed": {
        // Could mark Order as FAILED here. Skipped for now.
        break;
      }
      default:
        // ignore other event types
        break;
    }
  } catch (err) {
    console.error(`[stripe webhook] ${event.type} handler error:`, err);
    // Return 500 so Stripe retries — fulfilment is idempotent. We
    // intentionally don't record the event here so the retry runs
    // the handler again.
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  // ── Record successful processing for future dedup. ──────────
  // Best-effort: a P2002 here means a concurrent delivery beat us
  // to it (both passed the lookup, both processed — safe because
  // `fulfilCheckout` upserts on stripeSessionId). Any other failure
  // is logged but doesn't fail the response, since the side-effects
  // already happened.
  try {
    await db.webhookEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Concurrent retry won the race — harmless.
    } else {
      console.error("[stripe webhook] failed to record event id:", err);
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutPaid(session: Stripe.Checkout.Session) {
  const md = (session.metadata ?? {}) as Record<string, string | undefined>;
  const pm: "PROMPTPAY" | "CARD" =
    session.payment_method_types?.includes("promptpay") ? "PROMPTPAY" : "CARD";

  // Stripe surfaces the buyer's email in two places. `customer_details`
  // is the canonical post-checkout value (what the buyer actually typed
  // on Stripe's hosted page); `customer_email` is a pre-fill the
  // platform may have passed in. Prefer the former and fall back.
  const customerEmail =
    session.customer_details?.email ?? session.customer_email ?? null;

  await fulfilCheckout({
    stripeSessionId: session.id,
    stripePaymentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    metadata: {
      productId: md.productId,
      planId:    md.planId,
      username:  md.username,
    },
    amountTotal: session.amount_total,
    currency:    session.currency,
    paymentMethod: pm,
    customerEmail,
  });
}
