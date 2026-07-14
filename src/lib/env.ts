/**
 * Typed access to environment variables.
 *
 * Getters defer validation until the property is read, so importing
 * `env` somewhere shared (e.g. middleware) won't crash the whole
 * app when an unrelated var is missing.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function requiredMin(name: string, min: number): string {
  const v = required(name);
  if (v.length < min) {
    throw new Error(
      `${name} is too short (${v.length} chars) — must be at least ${min} for production use.`,
    );
  }
  return v;
}

export const env = {
  get DATABASE_URL() { return required("DATABASE_URL"); },
  get DIRECT_URL() { return process.env.DIRECT_URL ?? required("DATABASE_URL"); },
  /** 32+ char random string used to sign admin session JWTs. */
  get ADMIN_SESSION_SECRET() { return requiredMin("ADMIN_SESSION_SECRET", 32); },
  /** Shared secret the Roblox game server uses to call /api/checkwhitelist. */
  get WHITELIST_API_KEY() { return requiredMin("WHITELIST_API_KEY", 32); },

  /** Stripe — server-side. */
  get STRIPE_SECRET_KEY()     { return required("STRIPE_SECRET_KEY"); },
  get STRIPE_WEBHOOK_SECRET() { return required("STRIPE_WEBHOOK_SECRET"); },

  /** PayPal — server-side. Public client id is exposed to the browser
   *  via NEXT_PUBLIC_PAYPAL_CLIENT_ID (Next inlines it at build time). */
  get PAYPAL_CLIENT_ID()     { return required("PAYPAL_CLIENT_ID"); },
  get PAYPAL_CLIENT_SECRET() { return required("PAYPAL_CLIENT_SECRET"); },
  /** "sandbox" or "live". Defaults to sandbox so a forgotten env var
   *  can never accidentally hit the live API with sandbox creds. */
  get PAYPAL_MODE() {
    const v = (process.env.PAYPAL_MODE ?? "sandbox").trim().toLowerCase();
    return v === "live" ? "live" : "sandbox";
  },
  /** Currency PayPal bills in. Allowlist enforced so a typo can't
   *  silently fall through to an unsupported value (PayPal would
   *  reject with a confusing generic error). One source of truth on
   *  the server — the client receives it as a prop, never reads its
   *  own env var, so server + SDK never disagree. */
  get PAYPAL_CURRENCY() {
    const v = (process.env.PAYPAL_CURRENCY ?? "USD").trim().toUpperCase();
    return v === "THB" ? "THB" : "USD";
  },

  /** Public site origin for Stripe success/cancel callbacks.
   *  Falls back to localhost in dev. */
  get SITE_URL() {
    return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  },

  /** Read-only affiliate API key (afk_…) issued to us by aclassstore.
   *  Server-side only — used to pull our own commission dashboard.
   *  Empty when unconfigured; the dashboard shows a setup hint instead
   *  of crashing. */
  get AFFILIATE_API_KEY() {
    return process.env.AFFILIATE_API_KEY?.trim() ?? "";
  },
  /** Origin of the store we're an affiliate of. Trailing slashes are
   *  stripped so we can safely concatenate the API path. */
  get AFFILIATE_API_BASE() {
    return (process.env.AFFILIATE_API_BASE?.trim() || "https://aclassstore.com").replace(/\/+$/, "");
  },

  get NODE_ENV() {
    return (process.env.NODE_ENV ?? "development") as
      | "development"
      | "production"
      | "test";
  },
} as const;
