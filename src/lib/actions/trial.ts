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
const IP_LIMIT = 20;
const IP_WINDOW_MS = 60 * 1000;

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
  const rl = hit(`trial:ip:${ip}`, { limit: IP_LIMIT, windowMs: IP_WINDOW_MS });
  if (!rl.ok) {
    return { ok: false, code: "ip_rate_limited", retryAfterSec: retryAfterSeconds(rl.resetIn) };
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
