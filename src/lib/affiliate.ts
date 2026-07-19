/**
 * Affiliate dashboard client.
 *
 * We (JUDY-STUDIO) are an affiliate of aclassstore. They expose a
 * read-only REST endpoint that returns our own sales & commission data
 * (see docs/affiliate-api.md). This module calls it server-side only —
 * the `afk_…` key lives in AFFILIATE_API_KEY and must never reach the
 * browser — and normalises the response into a typed, crash-safe shape
 * for the /admin/affiliate dashboard.
 */
import { env } from "./env";

const DASHBOARD_PATH = "/api/affiliate/public/v1/dashboard";

// ── Response shape (mirrors docs/affiliate-api.md) ───────────────────

export type AffiliateProfile = {
  display_name: string | null;
  commission_pct: number;
  is_active: boolean;
};

export type AffiliateTotals = {
  pending: number;
  requested: number;
  paid: number;
  sales_count: number;
  currency: string;
};

export type AffiliateCode = {
  code: string;
  type: string; // "percent" | "fixed"
  value: number;
  commission_pct: number | null;
  product: string | null;
  is_active: boolean;
  used_count: number;
  max_uses: number | null;
  per_user_limit: number | null;
};

export type AffiliateSaleStatus = "pending" | "requested" | "paid" | "reversed";

export type AffiliateSale = {
  date: string;
  product: string | null;
  /** Roblox username the whitelist was granted to. May be absent on
   *  older records / partial payloads. */
  whitelisted_username: string | null;
  /** Buyer email. May be absent on older records / partial payloads. */
  email: string | null;
  sale_amount: number;
  commission_pct: number;
  commission: number;
  status: AffiliateSaleStatus | string;
  paid_at: string | null;
};

export type AffiliatePayoutStatus = "requested" | "paid" | "rejected" | "cancelled";

export type AffiliatePayout = {
  amount: number;
  method: string | null;
  status: AffiliatePayoutStatus | string;
  requested_at: string | null;
  paid_at: string | null;
};

export type AffiliateDashboard = {
  profile: AffiliateProfile;
  totals: AffiliateTotals;
  codes: AffiliateCode[];
  sales: AffiliateSale[];
  payouts: AffiliatePayout[];
};

/** Why a fetch failed — each maps to a distinct, actionable UI message. */
export type AffiliateError =
  | "missing_key" // AFFILIATE_API_KEY not set
  | "unauthorized" // 401 — key wrong / regenerated
  | "forbidden" // 403 — aclassstore turned API access off
  | "network" // couldn't reach the host
  | "bad_response"; // non-2xx or unparseable body

export type AffiliateResult =
  | { ok: true; data: AffiliateDashboard }
  | { ok: false; reason: AffiliateError; detail?: string };

// ── Fetcher ──────────────────────────────────────────────────────────

/**
 * Pull the live dashboard from aclassstore. Never throws — every failure
 * mode is returned as a typed result so the page renders a helpful state
 * instead of a 500. `cache: "no-store"` keeps the figures live (this is a
 * money dashboard; a stale cache would mislead).
 */
export async function getAffiliateDashboard(): Promise<AffiliateResult> {
  const key = env.AFFILIATE_API_KEY;
  if (!key) return { ok: false, reason: "missing_key" };

  let res: Response;
  try {
    res = await fetch(`${env.AFFILIATE_API_BASE}${DASHBOARD_PATH}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, reason: "network", detail: e instanceof Error ? e.message : String(e) };
  }

  if (res.status === 401) return { ok: false, reason: "unauthorized" };
  if (res.status === 403) return { ok: false, reason: "forbidden" };
  if (!res.ok) return { ok: false, reason: "bad_response", detail: `HTTP ${res.status}` };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, reason: "bad_response", detail: "Invalid JSON" };
  }

  const data = json as Partial<AffiliateDashboard> | null;
  if (!data || typeof data !== "object" || !data.profile || !data.totals) {
    return { ok: false, reason: "bad_response", detail: "Unexpected payload shape" };
  }

  // Defensive defaults — a partial payload (e.g. no codes yet) must never
  // crash the table renderers.
  return {
    ok: true,
    data: {
      profile: data.profile,
      totals: data.totals,
      codes: Array.isArray(data.codes) ? data.codes : [],
      sales: Array.isArray(data.sales) ? data.sales : [],
      payouts: Array.isArray(data.payouts) ? data.payouts : [],
    },
  };
}

// ── Display helpers ──────────────────────────────────────────────────
// Re-exported from a client-safe module so both the server page and the
// "use client" sales table can format without importing the fetcher.
export { fmtAffMoney, fmtAffDate } from "./affiliate-format";
