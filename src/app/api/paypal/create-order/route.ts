/**
 * POST /api/paypal/create-order
 *
 * Called by the PayPal Smart Button's `createOrder` callback. The
 * client sends { productId, planId, username } — we authoritatively:
 *   1. Validate the plan/product is still on sale.
 *   2. Compute the total (subtotal + PayPal surcharge) on the SERVER,
 *      so a tampered client can't lower the amount.
 *   3. Create a PayPal Order with that amount, returning the id back
 *      to the browser. The browser then hands the id to PayPal's
 *      hosted approval flow; on approval it calls our capture route.
 *
 * Rate-limit per IP — PayPal API has its own per-app caps and burst
 * pricing, but a friendly limit here keeps a casual abuser from
 * burning through our quota.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSettings, priceBreakdown } from "@/lib/settings";
import { normalizeRobloxUsername } from "@/lib/roblox";
import { createOrder, PaypalError } from "@/lib/paypal";
import { clientIp, hit, retryAfterSeconds } from "@/lib/rate-limit";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  productId: z.string().trim().min(1).max(80),
  planId:    z.string().trim().min(1).max(80),
  username:  z.string().trim().min(1).max(100),
});

// 30 create-order calls / minute / IP. Each call costs us one PayPal
// API hit + one of our DB lookups; we don't want a single browser
// hammering this in a loop.
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const gate = hit(`paypal:create:${ip}`, { limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS });
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
    return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
  }
  const username = normalizeRobloxUsername(parsed.data.username);
  if (!username) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }

  try {
    const plan = await db.plan.findUnique({
      where: { id: parsed.data.planId },
      include: { product: true },
    });
    if (!plan)                              return badRequest("Plan not found.");
    if (plan.productId !== parsed.data.productId) return badRequest("Plan/product mismatch.");
    if (!plan.isActive)                     return badRequest("Plan no longer available.");
    if (!plan.product.isActive)             return badRequest("Product unavailable.");
    if (plan.product.comingSoon)            return badRequest("Product not yet on sale.");

    const settings = await getSettings();
    // Honour the per-gateway kill switch from admin/settings. Returning
    // 403 (not 400) so the client can distinguish "user mistake" from
    // "method temporarily disabled" if it ever wants a friendlier message.
    if (!settings.paypalEnabled) {
      return NextResponse.json({ error: "PayPal is temporarily unavailable." }, { status: 403 });
    }
    // Currency comes from env.PAYPAL_CURRENCY — the SAME value the client
    // SDK was initialised with (passed through props from shop/page.tsx).
    // Single source of truth means SDK + server can never disagree on
    // currency, which would cause PayPal to reject with a generic error.
    const currency = env.PAYPAL_CURRENCY;
    const subtotalTHB = Number(plan.priceTHB);
    const subtotalUSD = Number(plan.priceUSD);
    const breakdown = priceBreakdown(subtotalTHB, "paypal", settings);

    // priceUSD sanity check — protects against admin typos and stale
    // FX rates (usdAuto=false). If the published USD price diverges
    // from the THB price by more than 50% of a sensible reference FX,
    // refuse rather than let the buyer underpay (or overpay) by 10×.
    //   Reference rate: 1 USD ≈ 33 THB (close enough for a sanity gate).
    //   Tolerance: 0.5x .. 2x of the implied price.
    if (currency === "USD") {
      const REFERENCE_USD_FROM_THB = subtotalTHB / 33;
      if (
        !Number.isFinite(subtotalUSD) ||
        subtotalUSD <= 0 ||
        subtotalUSD < REFERENCE_USD_FROM_THB * 0.5 ||
        subtotalUSD > REFERENCE_USD_FROM_THB * 2
      ) {
        console.error(
          "[paypal create] priceUSD out of sane range",
          `planId=${plan.id} priceTHB=${subtotalTHB} priceUSD=${subtotalUSD}`,
        );
        return badRequest("Plan pricing is out of date. Please contact support.");
      }
    }

    const subtotal =
      currency === "USD"
        ? roundCurrency(subtotalUSD * (1 + breakdown.feePercent / 100))
        : breakdown.total;
    if (subtotal < 1) return badRequest("Invalid plan price.");

    const description =
      `${plan.product.nameEn} — ${plan.labelEn}` +
      (breakdown.fee > 0 ? ` (incl. PayPal fee ${breakdown.feePercent}%)` : "");

    // customId carries our internal ids so the capture endpoint can
    // fulfil without trusting the client. PayPal hard-limits this to
    // 127 chars and TRUNCATES silently above that — a long username
    // (max 100) + JSON keys + cuid would overflow, producing a bad
    // payload that fails JSON.parse on capture. We use a compact
    // pipe-delimited format and drop productId (derivable from planId
    // server-side) to leave headroom.
    //   format:  "<planId>|<username>"   (max ≈ 25 + 1 + 100 = 126)
    const customId = `${plan.id}|${username}`;
    if (customId.length > 127) {
      // Belt-and-braces: refuse rather than let PayPal truncate.
      return badRequest("Checkout payload too long.");
    }

    const order = await createOrder({
      amount: subtotal,
      currency,
      description,
      customId,
    });

    return NextResponse.json({ id: order.id }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof PaypalError) {
      console.error("[paypal create] PaypalError:", err.tag, err.message);
      return NextResponse.json({ error: "PayPal could not create the order." }, { status: 502 });
    }
    console.error("[paypal create] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
