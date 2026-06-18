import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { safeEqual, keyFingerprint } from "@/lib/api-key";
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
 *     server's primary use case). Returns a SINGLE result for that game.
 * (B) WITHOUT a product/game filter — full picture across every game.
 *
 * Errors:
 *   400 — missing/invalid query
 *   401 — missing/invalid API key (generic "Unauthorized" — never
 *         distinguishes "missing config" from "wrong key" to caller)
 *   429 — rate limited
 *   500 — unexpected
 */

// Roblox username spec is 3–20 chars, [A-Za-z0-9_], no leading/trailing
// underscore, no double-underscore. Enforce here so junk like SQL or
// massive strings never reach the DB.
const ROBLOX_USERNAME = /^(?!.*__)(?!_)(?!.*_$)[A-Za-z0-9_]{3,20}$/;

const Query = z.object({
  username:    z.string().trim().regex(ROBLOX_USERNAME, "invalid roblox username"),
  productSlug: z.string().trim().min(1).max(80).optional(),
  gameId:      z.string().trim().min(1).max(80).optional(),
});

// Rate limits — chosen to comfortably cover a busy Roblox server
// (one check per joining player). Adjust if your traffic profile changes.
const IP_LIMIT      = 60;   // hits / minute / IP   — generous for a single game server
const IP_WINDOW_MS  = 60_000;
const KEY_LIMIT     = 600;  // hits / minute / API key — global ceiling across all servers
const KEY_WINDOW_MS = 60_000;

const COMMON_HEADERS = {
  // `no-store` prevents browser/CDN caching of these per-user lookups;
  // `private` reinforces that intent for any cache that might honor it.
  // `Vary: x-api-key` would also help, but since we never want this
  // cached at all, it's belt-and-braces.
  "cache-control": "private, no-store",
  "vary": "x-api-key",
};

function tooManyJson(resetIn: number) {
  const retryAfter = retryAfterSeconds(resetIn);
  return NextResponse.json(
    { error: "Rate limit exceeded.", status: "error" as const, retryAfterSec: retryAfter },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter), ...COMMON_HEADERS },
    },
  );
}

function unauthorized() {
  // Single generic message regardless of cause (missing env, missing
  // header, wrong key). Distinguishing them in the response would let
  // a probing attacker tell "server misconfigured" apart from "wrong
  // key" — the real reason is logged server-side instead.
  return NextResponse.json(
    { error: "Unauthorized.", status: "error" as const },
    { status: 401, headers: COMMON_HEADERS },
  );
}

export async function GET(req: NextRequest) {
  // ── 1. IP rate limit (pre-auth so anonymous spray gets cut early) ──
  const ip = clientIp(req);
  const ipCheck = hit(`checkwl:ip:${ip}`, { limit: IP_LIMIT, windowMs: IP_WINDOW_MS });
  if (!ipCheck.ok) return tooManyJson(ipCheck.resetIn);

  // ── 2. API key check (constant-time, length-agnostic) ───────
  const headerKey = req.headers.get("x-api-key") ?? "";
  if (!headerKey || headerKey.length > 256) {
    return unauthorized();
  }
  let expected = "";
  try {
    expected = env.WHITELIST_API_KEY;
  } catch (e) {
    console.error("[checkwhitelist] env not configured:", e instanceof Error ? e.message : e);
    return unauthorized();
  }
  if (!safeEqual(headerKey, expected)) {
    return unauthorized();
  }

  // ── 3. Per-key rate limit — protects DB from a single compromised
  //        key being hammered, even when spread across many IPs.
  //        Bucket key is a sha256 fingerprint so we never put any
  //        prefix of the real secret into a string identifier.
  const keyFp = keyFingerprint(expected);
  const keyCheck = hit(`checkwl:key:${keyFp}`, { limit: KEY_LIMIT, windowMs: KEY_WINDOW_MS });
  if (!keyCheck.ok) return tooManyJson(keyCheck.resetIn);

  // ── 4. Parse query ──────────────────────────────────────────
  const parsed = Query.safeParse({
    username:    req.nextUrl.searchParams.get("username") ?? "",
    productSlug: req.nextUrl.searchParams.get("productSlug") ?? undefined,
    gameId:      req.nextUrl.searchParams.get("gameId")     ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing or invalid query. Required: ?username=…", status: "error" as const },
      { status: 400, headers: COMMON_HEADERS },
    );
  }
  const { username, productSlug, gameId } = parsed.data;

  // ── 5. Lookup ───────────────────────────────────────────────
  // Branch on whether the caller scoped to a single game/product:
  //   - With filter  → single-result envelope (Roblox runtime API)
  //   - Without one  → array envelope listing every game this username
  //                    has access to (admin/dashboard view).
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
          // Drop internal `product.id` — Roblox-side code only needs
          // slug + game_id + name. Don't expose row IDs that other
          // endpoints might accept.
          product: result.product
            ? {
                slug:    result.product.slug,
                name_en: result.product.nameEn,
                game_id: result.product.gameId,
              }
            : null,
          checked_at: result.checkedAt,
        },
        { headers: COMMON_HEADERS },
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
            slug:    e.product.slug,
            name_en: e.product.nameEn,
            game_id: e.product.gameId,
          },
        })),
        checked_at: new Date().toISOString(),
      },
      { headers: COMMON_HEADERS },
    );
  } catch (e) {
    // Sanitised log: don't dump the full error object since it may
    // include Prisma query params (which contain the searched
    // username — minor PII).
    const message = e instanceof Error ? e.message : "unknown";
    const code = (e as { code?: string })?.code;
    console.error("[checkwhitelist] error:", message, code ? `(code: ${code})` : "");
    return NextResponse.json(
      { error: "Internal error.", status: "error" as const },
      { status: 500, headers: COMMON_HEADERS },
    );
  }
}
