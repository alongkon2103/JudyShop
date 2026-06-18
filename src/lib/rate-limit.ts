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
 *
 * Eviction: STORE is GC'd lazily — entries with zero hits after a
 * cleanup pass are removed. Without this an attacker could spam unique
 * keys (e.g. spoofed X-Forwarded-For) and grow STORE unbounded.
 */

type Window = { hits: number[]; limit: number; windowMs: number };

const STORE = new Map<string, Window>();

// Lazy eviction every ~5 min — runs inside hit() so we don't need a
// timer (which would keep the process alive in tests).
const EVICT_INTERVAL_MS = 5 * 60 * 1000;
let lastEvict = 0;
function maybeEvict(now: number): void {
  if (now - lastEvict < EVICT_INTERVAL_MS) return;
  lastEvict = now;
  for (const [key, win] of STORE.entries()) {
    const cutoff = now - win.windowMs;
    while (win.hits.length && win.hits[0]! <= cutoff) win.hits.shift();
    if (win.hits.length === 0) STORE.delete(key);
  }
}

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
  maybeEvict(now);

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
 * Best-effort caller IP from common proxy headers.
 *
 * Header priority (first non-empty wins):
 *   1. `cf-connecting-ip`   — Cloudflare sets this and strips client-supplied versions
 *   2. `x-vercel-forwarded-for` — Vercel platform header
 *   3. `x-real-ip`          — common nginx-style header (set by trusted proxy)
 *   4. `x-forwarded-for`    — RFC standard; we take the FIRST entry (client IP)
 *
 * Trust model: when `TRUST_PROXY=1` is set, we honor the headers above.
 * Otherwise (direct exposure / dev), we ignore them and bucket by the
 * fallback below. This prevents an attacker on an untrusted-network
 * deploy from rotating their bucket per-request by spoofing the header.
 *
 * Fallback: `_dev_` in development, `_unknown_` in production. The
 * production fallback intentionally collapses all unidentified callers
 * into one bucket — this fails-closed (sharing the cap) rather than
 * fails-open (granting everyone fresh buckets). Always configure a
 * trusted proxy in production.
 */
export function clientIp(reqOrHeaders: Request | Headers): string {
  const headers = reqOrHeaders instanceof Headers ? reqOrHeaders : reqOrHeaders.headers;
  const trustProxy = process.env.TRUST_PROXY === "1";

  if (trustProxy) {
    const cf = headers.get("cf-connecting-ip");
    if (cf) return cf.trim();
    const vercel = headers.get("x-vercel-forwarded-for");
    if (vercel) {
      const first = vercel.split(",")[0]?.trim();
      if (first) return first;
    }
    const real = headers.get("x-real-ip");
    if (real) return real.trim();
    const fwd = headers.get("x-forwarded-for");
    if (fwd) {
      const first = fwd.split(",")[0]?.trim();
      if (first) return first;
    }
  }

  return process.env.NODE_ENV === "production" ? "_unknown_" : "_dev_";
}

/** Format `Retry-After` header value (seconds, rounded up). */
export function retryAfterSeconds(resetIn: number): number {
  return Math.max(1, Math.ceil(resetIn / 1000));
}
