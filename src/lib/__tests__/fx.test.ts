/**
 * Tests for `getThbToUsdRate` / `convertThbToUsd` — the FX layer that
 * powers the admin "approx USD" pricing display.
 *
 * `fetch` is mocked at the global level so we can:
 *   - Simulate a healthy API response (live rate)
 *   - Simulate a non-OK HTTP status (fallback)
 *   - Simulate a malformed payload (fallback)
 *   - Simulate a network error / thrown fetch (fallback)
 *
 * The fallback rate is intentionally NOT asserted to a specific number
 * — the function reserves the right to bump it. We just assert that
 * `source === 'fallback'` and the result is a finite number.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { getThbToUsdRate, convertThbToUsd } from "../fx";

const originalFetch = global.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn() as any;
});

describe("getThbToUsdRate — live success", () => {
  it("returns the live rate from a healthy API response", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: "success",
        time_last_update_utc: "Mon, 08 Jun 2026 00:00:00 +0000",
        rates: { USD: 0.0285 },
      }),
    });
    const r = await getThbToUsdRate();
    expect(r.rate).toBe(0.0285);
    expect(r.source).toBe("live");
    expect(r.asOf).toBe("Mon, 08 Jun 2026 00:00:00 +0000");
  });

  it("uses the live rate to compute a USD amount via convertThbToUsd", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        time_last_update_utc: "x",
        rates: { USD: 0.03 },
      }),
    });
    const r = await convertThbToUsd(100); // 100 THB * 0.03 = $3.00
    expect(r.usd).toBe(3);
    expect(r.source).toBe("live");
    expect(r.rate).toBe(0.03);
  });

  it("rounds USD to 2 decimals", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rates: { USD: 0.0287 } }),
    });
    const r = await convertThbToUsd(199);
    // 199 * 0.0287 = 5.7113 → rounds to 5.71
    expect(r.usd).toBe(5.71);
  });
});

describe("getThbToUsdRate — fallback paths", () => {
  it("falls back when the API returns a non-OK status", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    const r = await getThbToUsdRate();
    expect(r.source).toBe("fallback");
    expect(Number.isFinite(r.rate)).toBe(true);
    expect(r.rate).toBeGreaterThan(0);
  });

  it("falls back when the payload has no USD rate", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rates: {} }),
    });
    const r = await getThbToUsdRate();
    expect(r.source).toBe("fallback");
  });

  it("falls back when USD rate is NaN / zero / negative", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rates: { USD: 0 } }),
    });
    expect((await getThbToUsdRate()).source).toBe("fallback");

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rates: { USD: -1 } }),
    });
    expect((await getThbToUsdRate()).source).toBe("fallback");

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rates: { USD: Number.NaN } }),
    });
    expect((await getThbToUsdRate()).source).toBe("fallback");
  });

  it("falls back when fetch itself throws (network error)", async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error("network down"));
    const r = await getThbToUsdRate();
    expect(r.source).toBe("fallback");
    expect(Number.isFinite(r.rate)).toBe(true);
  });

  it("convertThbToUsd flags the fallback source through to its caller", async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error("nope"));
    const r = await convertThbToUsd(100);
    expect(r.source).toBe("fallback");
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});
