import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time-ish compare. We deliberately hash both inputs to a
 * fixed-length digest BEFORE timingSafeEqual so unequal lengths don't
 * short-circuit and leak the secret length through response time.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Stable, non-reversible 16-char identifier derived from a secret —
 * safe to use as a rate-limit bucket key (or in logs) without leaking
 * any prefix of the real value.
 */
export function keyFingerprint(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex").slice(0, 16);
}
