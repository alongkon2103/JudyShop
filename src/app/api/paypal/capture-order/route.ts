/**
 * POST /api/paypal/capture-order
 *
 * Called by the PayPal Smart Button's `onApprove` callback. The
 * client sends { orderID } (the PayPal Order id we returned from
 * create-order). We:
 *   1. Capture the order via PayPal's API (money moves here).
 *   2. Read the `custom_id` PayPal echoes back — it contains the
 *      planId/username we stamped at create time, so we don't
 *      trust any of those from the request body.
 *   3. Look up the plan, recompute the expected amount, and reject
 *      if PayPal billed an amount that doesn't match what we expected
 *      for that plan. This is the defence against an attacker capturing
 *      a $0.50 order with a custom_id pointing at an expensive plan.
 *   4. Call fulfilPaypalCheckout to atomically write Order + Whitelist.
 *   5. Set an HttpOnly cookie pinning this browser to the paypalOrderId
 *      so /success can render order details without a leaked URL
 *      disclosing premium downloads to anyone with the link.
 *
 * Idempotent: PayPal returns the same captureId on retried captures,
 * and `fulfilPaypalCheckout` upserts on `paypalOrderId`. Safe to
 * re-run if the browser tab refreshes mid-callback.
 *
 * Response shape mirrors what the client needs:
 *   { ok: true, redirectUrl: "/success?paypal_order=..." }
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { captureOrder, PaypalError } from "@/lib/paypal";
import { fulfilPaypalCheckout } from "@/lib/checkout";
import { db } from "@/lib/db";
import { getSettings, priceBreakdown } from "@/lib/settings";
import { clientIp, hit, retryAfterSeconds } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { setPaypalOwnerCookie } from "@/lib/checkout-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  orderID: z.string().trim().min(1).max(80),
});

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

// We tolerate a 0.50 unit gap between the captured amount and what we
// expect for the plan. That's enough to absorb USD↔THB rounding (1 sat
// here, 1 cent there) without letting a buyer underpay by anything
// meaningful.
const AMOUNT_TOLERANCE = 0.5;

/** Short tag for logs — full IDs never appear in stdout for PII reasons. */
function tag(s: string | null | undefined): string {
  if (!s) return "—";
  return s.length <= 8 ? s : `…${s.slice(-6)}`;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const gate = hit(`paypal:capture:${ip}`, { limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS });
  if (!gate.ok) {
    const retryAfter = retryAfterSeconds(gate.resetIn);
    return NextResponse.json(
      { error: "Too many requests.", retryAfterSec: retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing orderID." }, { status: 400 });
  }

  try {
    const capture = await captureOrder(parsed.data.orderID);

    // ── 1. Parse custom_id (compact "planId|username" format) ──
    // PayPal echoes our customId back from the order we created at
    // create-order time. We don't trust the request body for planId
    // or username — only this echoed value.
    if (!capture.customId) {
      console.error("[paypal capture] missing custom_id", tag(capture.orderId));
      return NextResponse.json({ error: "Order metadata missing." }, { status: 502 });
    }
    const sepIdx = capture.customId.indexOf("|");
    if (sepIdx < 1 || sepIdx === capture.customId.length - 1) {
      console.error("[paypal capture] custom_id bad format", tag(capture.orderId));
      return NextResponse.json({ error: "Order metadata invalid." }, { status: 502 });
    }
    const planId   = capture.customId.slice(0, sepIdx);
    const username = capture.customId.slice(sepIdx + 1);

    // ── 2. Look up plan + amount sanity check ────────────────
    // Reload the plan + settings server-side and recompute what the
    // capture amount SHOULD have been. If the captured amount disagrees,
    // refuse to grant the whitelist — the buyer paid something other
    // than what we asked for (tampered order, stale price, FX drift, etc).
    const plan = await db.plan.findUnique({
      where: { id: planId },
      include: { product: { select: { id: true } } },
    });
    if (!plan) {
      console.error("[paypal capture] plan not found", tag(capture.orderId));
      return NextResponse.json({ error: "Plan not found." }, { status: 502 });
    }
    const settings = await getSettings();
    const breakdownTHB = priceBreakdown(Number(plan.priceTHB), "paypal", settings);
    const expected =
      capture.currency.toUpperCase() === "USD"
        ? Math.round(Number(plan.priceUSD) * (1 + breakdownTHB.feePercent / 100) * 100) / 100
        : breakdownTHB.total;
    const paid = Number(capture.amount);
    if (!Number.isFinite(paid) || Math.abs(paid - expected) > AMOUNT_TOLERANCE) {
      console.error(
        "[paypal capture] amount mismatch",
        tag(capture.orderId),
        `paid=${paid} expected=${expected} currency=${capture.currency}`,
      );
      // 422 (Unprocessable) makes it clear this isn't a bug in the
      // buyer's request — the amount itself was wrong.
      return NextResponse.json({ error: "Payment amount did not match expected total." }, { status: 422 });
    }

    // ── 3. Atomic Order + Whitelist write ────────────────────
    await fulfilPaypalCheckout({
      paypalOrderId:   capture.orderId,
      paypalCaptureId: capture.captureId,
      productId:  plan.product.id,
      planId:     plan.id,
      username,
      amount:     paid,
      currency:   capture.currency,
      payerEmail: capture.payerEmail,
    });

    // ── 4. Pin this browser to the order via HttpOnly cookie ─
    setPaypalOwnerCookie(capture.orderId);

    // Success redirect — reuse the existing /success page (locale-prefixed
    // route handles this gracefully). `paypal_order` lets the page find
    // the row; the cookie set above proves the browser owns this checkout.
    const redirectUrl = `${env.SITE_URL}/success?paypal_order=${encodeURIComponent(capture.orderId)}`;
    return NextResponse.json({ ok: true, redirectUrl }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof PaypalError) {
      // Don't log err.message — PayPal error bodies include payer info,
      // debug IDs paired with our internal data, etc. Tag + truncated
      // orderId is enough to reproduce server-side without leaking PII.
      console.error("[paypal capture] PaypalError", err.tag, tag(parsed.data.orderID));
      const userMsg =
        err.tag === "capture_not_completed"
          ? "PayPal did not complete the payment. Please try again."
          : "PayPal capture failed. Please try again.";
      return NextResponse.json({ error: userMsg }, { status: 502 });
    }
    console.error(
      "[paypal capture] error",
      tag(parsed.data.orderID),
      err instanceof Error ? err.name : "unknown",
    );
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
