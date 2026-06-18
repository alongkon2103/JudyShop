"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { startTrial } from "@/lib/trial";
import { clientIp, hit, retryAfterSeconds } from "@/lib/rate-limit";

const Input = z.object({
  productId: z.string().min(1).max(50),
  username:  z.string().min(1).max(100),
});

// Cap rapid-fire trial requests at the edge before we even hit Postgres.
// Two layers: a burst cap to stop spamming AND a daily-ish cap to stop
// an attacker from cycling Roblox usernames to mint unlimited trials
// from a single IP (per-username/product 24h check in trial.ts can't
// catch that — different usernames bypass it entirely).
const IP_BURST_LIMIT  = 20;
const IP_BURST_WINDOW = 60 * 1000;
const IP_DAILY_LIMIT  = 5;
const IP_DAILY_WINDOW = 24 * 60 * 60 * 1000;

/** All possible error codes a client may receive. Client maps to i18n. */
export type StartTrialErrorCode =
  | "invalid_request"
  | "ip_rate_limited"
  | "invalid_username"
  | "product_not_found"
  | "product_inactive"
  | "trial_disabled"
  | "rate_limited"
  | "already_active"
  | "generic";

export type StartTrialActionResult =
  | { ok: true;  expiresAt: string; minutes: number }
  | { ok: false; code: StartTrialErrorCode; retryAfterSec?: number };

/**
 * Public "Try N minutes" action — called from the ProductModal.
 *
 * Returns a stable `code` (not a pre-translated message) so the client
 * can render the correct copy for the current locale. We intentionally
 * keep the reason coarse: scrapers can't probe usernames via the codes
 * any more than they could before.
 */
export async function startTrialAction(payload: unknown): Promise<StartTrialActionResult> {
  const parsed = Input.safeParse(payload);
  if (!parsed.success) return { ok: false, code: "invalid_request" };

  const h = headers();
  const ip = clientIp(h);

  // Burst cap — short window, blocks click-spam / script floods.
  const burst = hit(`trial:ip:burst:${ip}`, {
    limit: IP_BURST_LIMIT, windowMs: IP_BURST_WINDOW,
  });
  if (!burst.ok) {
    return { ok: false, code: "ip_rate_limited", retryAfterSec: retryAfterSeconds(burst.resetIn) };
  }

  // Daily cap — caps total trials ever granted to a single IP/day,
  // independent of which username/product they target. Stops the
  // "cycle through Roblox usernames" abuse pattern.
  const daily = hit(`trial:ip:daily:${ip}`, {
    limit: IP_DAILY_LIMIT, windowMs: IP_DAILY_WINDOW,
  });
  if (!daily.ok) {
    return { ok: false, code: "ip_rate_limited", retryAfterSec: retryAfterSeconds(daily.resetIn) };
  }

  try {
    const res = await startTrial({
      productId: parsed.data.productId,
      username:  parsed.data.username,
      ip,
      userAgent: h.get("user-agent") ?? null,
    });
    if (res.ok) return { ok: true, expiresAt: res.expiresAt, minutes: res.minutes };
    return { ok: false, code: res.reason };
  } catch (e) {
    console.error("[startTrialAction]", e);
    return { ok: false, code: "generic" };
  }
}
