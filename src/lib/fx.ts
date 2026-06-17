/**
 * FX rate fetcher — THB → USD.
 * Uses open.er-api.com (free, no auth, hourly updates).
 * Cached for 1 hour via Next.js fetch cache.
 *
 * Fallback rate is used if the API is unreachable so that admin
 * forms keep working offline.
 */

const FALLBACK_THB_TO_USD = 1 / 36; // ≈ 0.02778 — rough; only used on API failure
const API_URL = "https://open.er-api.com/v6/latest/THB";

type Result = { rate: number; source: "live" | "fallback"; asOf: string };

export async function getThbToUsdRate(): Promise<Result> {
  try {
    const res = await fetch(API_URL, {
      // Cache for an hour at the data layer — survives across requests.
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as {
      result?: string;
      time_last_update_utc?: string;
      rates?: { USD?: number };
    };
    const rate = data.rates?.USD;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("invalid rate payload");
    }
    return {
      rate,
      source: "live",
      asOf: data.time_last_update_utc ?? new Date().toUTCString(),
    };
  } catch {
    return {
      rate: FALLBACK_THB_TO_USD,
      source: "fallback",
      asOf: new Date().toUTCString(),
    };
  }
}

/** Convert THB amount → USD, rounded to 2 decimals. */
export async function convertThbToUsd(thb: number): Promise<{ usd: number; rate: number; source: "live" | "fallback" }> {
  const { rate, source } = await getThbToUsdRate();
  return { usd: Math.round(thb * rate * 100) / 100, rate, source };
}
