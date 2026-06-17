"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { lookupRobloxUser, type LookupResult } from "@/lib/roblox";
import { clientIp, hit, retryAfterSeconds } from "@/lib/rate-limit";

// Roblox itself rate-limits, but we don't want a runaway client to chew
// through their quota — cap per IP. Cheap enough that legit users typing
// in a username won't notice.
const IP_LIMIT = 30;
const IP_WINDOW_MS = 60_000;

const Input = z.object({
  username: z.string().min(1).max(40),
});

export type LookupErrorCode =
  | "invalid"           // bad request payload / username doesn't match Roblox format
  | "ip_rate_limited"
  | "not_found"
  | "network";

export type LookupActionResult =
  | { ok: true; user: { id: number; username: string; displayName: string; avatarUrl: string | null } }
  | { ok: false; code: LookupErrorCode; retryAfterSec?: number };

/**
 * Server action used by the ProductModal username field — confirms the
 * Roblox account exists and returns its display name + avatar so the
 * customer can verify they're about to grant access to the right account
 * before paying.
 *
 * Returns stable codes (not localized strings) so the client renders
 * the right copy for the current locale.
 */
export async function lookupUsername(payload: unknown): Promise<LookupActionResult> {
  const parsed = Input.safeParse(payload);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const rl = hit(`roblox:ip:${clientIp(headers())}`, { limit: IP_LIMIT, windowMs: IP_WINDOW_MS });
  if (!rl.ok) {
    return { ok: false, code: "ip_rate_limited", retryAfterSec: retryAfterSeconds(rl.resetIn) };
  }

  const res: LookupResult = await lookupRobloxUser(parsed.data.username);
  if (!res.ok) return { ok: false, code: res.reason };
  return { ok: true, user: res.user };
}
