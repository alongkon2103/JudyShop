/**
 * In-memory sliding-window rate limiter.
 *
 * Keys are arbitrary strings (e.g. `"login:ip:1.2.3.4"`).
 * State lives in module-scope `Map`s, so it resets on every server
 * restart and does NOT shard across multiple instances.
 *
 *   ✅  Single-instance Node deploys (PM2, single Vercel function lambda,
 *       Docker container) — protects against script-kiddie brute force.
 *   ⚠️  Multi-instance / serverless cold starts — each lambda has its own
 *       map. Replace with Redis (Upstash, etc.) before scaling out, but
 *       the call surface (`hit()` returns `{ ok, remaining, resetIn }`)
 *       is designed to drop in with minimal change.
 */

type Window = { hits: number[]; limit: number; windowMs: number };

const STORE = new Map<string, Window>();

export type RateLimitResult = {
  /** True when the request is within the limit. */
  ok: boolean;
  /** Remaining hits in the current window (after recording this hit). */
  remaining: number;
  /** Milliseconds until the window resets / oldest hit falls off. */
  resetIn: number;
};

export function hit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  let win = STORE.get(key);
  if (!win) {
    win = { hits: [], limit: opts.limit, windowMs: opts.windowMs };
    STORE.set(key, win);
  }

  // Drop hits that have aged out of the window.
  while (win.hits.length && win.hits[0]! <= cutoff) win.hits.shift();

  if (win.hits.length >= opts.limit) {
    const oldest = win.hits[0]!;
    return {
      ok: false,
      remaining: 0,
      resetIn: Math.max(0, oldest + opts.windowMs - now),
    };
  }

  win.hits.push(now);
  return {
    ok: true,
    remaining: opts.limit - win.hits.length,
    resetIn: opts.windowMs,
  };
}

/**
 * Drop a key's counter — call after a successful login so a legit
 * user's previous failed attempts don't keep them throttled.
 */
export function reset(key: string): void {
  STORE.delete(key);
}

/**
 * Best-effort caller IP from common proxy headers, falling back to
 * an opaque placeholder so the key is still bucketed.
 *
 * We trust the FIRST entry in `x-forwarded-for` — only do this behind
 * a proxy that strips client-supplied versions of that header (Vercel,
 * Cloudflare, Fly, most CDNs). Without a proxy, the header is missing
 * and we use a fixed bucket — which is acceptable for dev.
 */
export function clientIp(reqOrHeaders: Request | Headers): string {
  const headers = reqOrHeaders instanceof Headers ? reqOrHeaders : reqOrHeaders.headers;
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  // Fallback bucket — better than nothing, but unprotected against
  // shared NAT in dev.
  return "_unknown_";
}

/** Format `Retry-After` header value (seconds, rounded up). */
export function retryAfterSeconds(resetIn: number): number {
  return Math.max(1, Math.ceil(resetIn / 1000));
}
