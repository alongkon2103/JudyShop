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

export const env = {
  get DATABASE_URL() { return required("DATABASE_URL"); },
  get DIRECT_URL() { return process.env.DIRECT_URL ?? required("DATABASE_URL"); },
  /** 32+ char random string used to sign admin session JWTs. */
  get ADMIN_SESSION_SECRET() { return required("ADMIN_SESSION_SECRET"); },
  /** Shared secret the Roblox game server uses to call /api/checkwhitelist. */
  get WHITELIST_API_KEY() { return required("WHITELIST_API_KEY"); },

  /** Stripe — server-side. */
  get STRIPE_SECRET_KEY()     { return required("STRIPE_SECRET_KEY"); },
  get STRIPE_WEBHOOK_SECRET() { return required("STRIPE_WEBHOOK_SECRET"); },

  /** Public site origin for Stripe success/cancel callbacks.
   *  Falls back to localhost in dev. */
  get SITE_URL() {
    return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  },

  get NODE_ENV() {
    return (process.env.NODE_ENV ?? "development") as
      | "development"
      | "production"
      | "test";
  },
} as const;
