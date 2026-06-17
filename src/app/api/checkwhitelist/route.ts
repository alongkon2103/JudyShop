import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/api-key";
import { checkWhitelist, findUserWhitelistEntries } from "@/lib/whitelist";
import { clientIp, hit, retryAfterSeconds } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/checkwhitelist?username=xxx[&productSlug=yyy|&gameId=zzz]
 *
 * Headers:
 *   x-api-key: <WHITELIST_API_KEY from .env>   (required)
 *
 * Two response shapes — the route picks one based on whether the caller
 * scoped the query to a single product/game:
 *
 * (A) WITH `productSlug` or `gameId` — per-game check (the Roblox game
 *     server's primary use case). Returns a SINGLE result for that game:
 *
 *   {
 *     "status": "active" | "expired" | "not_found",
 *     "username": "judy_player",
 *     "expires_at": "2026-07-08T00:00:00.000Z" | null,
 *     "lifetime": false,
 *     "duration": "30days" | "permanent" | "trial" | "Nd" | null,
 *     "source":   "stripe" | "trial" | "manual" | "promo" | "refund_revert" | null,
 *     "trial":    false,
 *     "product":  { "id", "slug", "name_en", "game_id" } | null,
 *     "checked_at": "2026-06-08T..."
 *   }
 *
 * (B) WITHOUT a product/game filter — full picture across every game the
 *     username is whitelisted for. Returns an ARRAY of entries. Useful
 *     for admin/debug tooling and dashboards that want to show "this
 *     player has access to X, Y, Z":
 *
 *   {
 *     "status": "found" | "not_found",
 *     "username": "judy_player",
 *     "count":   2,
 *     "entries": [
 *       { same per-entry shape as (A), one per product },
 *       ...
 *     ],
 *     "checked_at": "2026-06-08T..."
 *   }
 *
 * Errors:
 *   400 — missing/invalid query
 *   401 — missing/invalid API key
 *   429 — rate limited
 *   500 — unexpected
 */

const Query = z.object({
  username:    z.string().min(1).max(100),
  productSlug: z.string().trim().min(1).max(80).optional(),
  gameId:      z.string().trim().min(1).max(80).optional(),
});

// Rate limits — chosen to comfortably cover a busy Roblox server
// (one check per joining player). Adjust if your traffic profile changes.
const IP_LIMIT      = 60;   // hits / minute / IP   — generous for a single game server
const IP_WINDOW_MS  = 60_000;
const KEY_LIMIT     = 600;  // hits / minute / API key — global ceiling across all servers
const KEY_WINDOW_MS = 60_000;

function tooManyJson(resetIn: number) {
  const retryAfter = retryAfterSeconds(resetIn);
  return NextResponse.json(
    { error: "Rate limit exceeded.", status: "error" as const, retryAfterSec: retryAfter },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter), "cache-control": "no-store" },
    },
  );
}

export async function GET(req: NextRequest) {
  // ── 1. IP rate limit (pre-auth so anonymous spray gets cut early) ──
  const ip = clientIp(req);
  const ipCheck = hit(`checkwl:ip:${ip}`, { limit: IP_LIMIT, windowMs: IP_WINDOW_MS });
  if (!ipCheck.ok) return tooManyJson(ipCheck.resetIn);

  // ── 2. API key check (constant-time) ────────────────────────
  const headerKey = req.headers.get("x-api-key") ?? "";
  let expected = "";
  try {
    expected = env.WHITELIST_API_KEY;
  } catch {
    // Env not configured at all — fail closed.
    return jsonError(401, "Server is not configured for whitelist API.");
  }
  if (!headerKey || !safeEqual(headerKey, expected)) {
    return jsonError(401, "Invalid API key.");
  }

  // ── 3. Per-key rate limit — protects DB from a single compromised
  //        key being hammered, even when spread across many IPs.
  //        Bucket by a hashed-ish fingerprint so we don't log the key.
  const keyFp = expected.slice(0, 8);
  const keyCheck = hit(`checkwl:key:${keyFp}`, { limit: KEY_LIMIT, windowMs: KEY_WINDOW_MS });
  if (!keyCheck.ok) return tooManyJson(keyCheck.resetIn);

  // ── 4. Parse query ──────────────────────────────────────────
  const parsed = Query.safeParse({
    username:    req.nextUrl.searchParams.get("username") ?? "",
    productSlug: req.nextUrl.searchParams.get("productSlug") ?? undefined,
    gameId:      req.nextUrl.searchParams.get("gameId")     ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(400, "Missing or invalid query. Required: ?username=…");
  }
  const { username, productSlug, gameId } = parsed.data;

  // ── 5. Lookup ───────────────────────────────────────────────
  // Branch on whether the caller scoped to a single game/product:
  //   - With filter  → single-result envelope (Roblox runtime API)
  //   - Without one  → array envelope listing every game this username
  //                    has access to (admin/dashboard view).
  // Splitting the shapes makes the contract honest: when the caller
  // doesn't specify a game we can't pretend to have a single answer.
  try {
    if (productSlug || gameId) {
      const result = await checkWhitelist(username, { productSlug, gameId });
      return NextResponse.json(
        {
          status:     result.status,
          username:   result.username,
          expires_at: result.expiresAt,
          lifetime:   result.lifetime,
          duration:   result.duration,
          source:     result.source,
          trial:      result.trial,
          product: result.product
            ? {
                id:      result.product.id,
                slug:    result.product.slug,
                name_en: result.product.nameEn,
                game_id: result.product.gameId,
              }
            : null,
          checked_at: result.checkedAt,
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const lookup = await findUserWhitelistEntries(username);
    return NextResponse.json(
      {
        status: lookup.entries.length > 0 ? "found" as const : "not_found" as const,
        username: lookup.username,
        count: lookup.entries.length,
        entries: lookup.entries.map((e) => ({
          status:     e.status,
          expires_at: e.expiresAt,
          lifetime:   e.lifetime,
          duration:   e.duration,
          source:     e.source,
          trial:      e.trial,
          product: {
            id:      e.product.id,
            slug:    e.product.slug,
            name_en: e.product.nameEn,
            game_id: e.product.gameId,
          },
        })),
        checked_at: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    console.error("[checkwhitelist] error", e);
    return jsonError(500, "Internal error.");
  }
}

function jsonError(status: number, message: string) {
  return NextResponse.json(
    { error: message, status: "error" as const },
    { status, headers: { "cache-control": "no-store" } },
  );
}
