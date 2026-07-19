/**
 * Pure display helpers for affiliate data — safe to import from both
 * server components and client components (no `env`, no fetch, no
 * Node-only APIs). Kept separate from affiliate.ts so a "use client"
 * table can format money/dates without pulling the server-side fetcher
 * (and its process.env access) into the browser bundle.
 */

/** Money formatter — commissions carry satang, so always show 2 dp. */
export function fmtAffMoney(amount: number, currency = "THB"): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: currency || "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

/** ISO 8601 → "13 ก.ค. 2026 16:41". Returns "—" for null/invalid. */
export function fmtAffDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
