/**
 * Pins a Stripe Checkout Session ID to the browser that created it.
 *
 * Why: `/success?session_id=...` shows order details *and* download
 * links for paid digital assets (presets, overlays). The session_id
 * is a long random string, but it can leak via referer logs, browser
 * history, shared screenshots, etc. Without binding, anyone with
 * the link could view the order and download the premium files.
 *
 * Mechanism: when `startCheckout` server action creates the Stripe
 * session, we set an HttpOnly cookie holding the session id. The
 * `/success` page only reveals owner-only content when the cookie
 * matches the `session_id` query param. Cookies travel back through
 * the Stripe-hosted-page round-trip because SameSite=lax permits
 * top-level navigations (which is what Stripe's success_url redirect
 * is).
 */
import { cookies } from "next/headers";
import { env } from "./env";

const COOKIE_NAME = "judyshop_checkout_session";
// 24h — long enough for refresh / browser-back / PromptPay's async
// confirmation, short enough that a stale cookie can't accumulate.
const TTL_SECONDS = 60 * 60 * 24;

/** Pin the browser to this checkout session. Call right after
 *  Stripe returns a session URL. */
export function setCheckoutSessionCookie(sessionId: string): void {
  cookies().set({
    name: COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

/** Read the pinned session id, or null if the browser has no cookie. */
export function readCheckoutSessionCookie(): string | null {
  return cookies().get(COOKIE_NAME)?.value ?? null;
}

/** True when the cookie matches the supplied session id — i.e. the
 *  visiting browser is the one that initiated checkout. */
export function isCheckoutOwner(sessionId: string | undefined | null): boolean {
  if (!sessionId) return false;
  return readCheckoutSessionCookie() === sessionId;
}
