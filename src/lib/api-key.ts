import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time compare to avoid leaking the secret length through
 * response-time differences.
 */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
