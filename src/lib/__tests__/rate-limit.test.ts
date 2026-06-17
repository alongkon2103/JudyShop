/**
 * Tests for the in-memory sliding-window rate limiter.
 *
 * Because `STORE` is module-scope state, we (a) use unique keys per
 * test to avoid cross-pollution and (b) call `reset(key)` in cleanup
 * so a leaked counter can't taint a later test. `vi.useFakeTimers`
 * lets us advance "now" deterministically without `setTimeout`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hit, reset, clientIp, retryAfterSeconds } from "../rate-limit";

describe("rate-limit · hit()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("basic counting", () => {
    it("allows the first hit and reports remaining=limit-1", () => {
      const key = "t-basic-1";
      const r = hit(key, { limit: 3, windowMs: 60_000 });
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(2);
      reset(key);
    });

    it("counts down correctly across multiple hits up to the limit", () => {
      const key = "t-basic-2";
      const opts = { limit: 3, windowMs: 60_000 };
      expect(hit(key, opts)).toMatchObject({ ok: true, remaining: 2 });
      expect(hit(key, opts)).toMatchObject({ ok: true, remaining: 1 });
      expect(hit(key, opts)).toMatchObject({ ok: true, remaining: 0 });
      reset(key);
    });

    it("rejects the (limit+1)-th hit with ok=false, remaining=0", () => {
      const key = "t-basic-3";
      const opts = { limit: 2, windowMs: 60_000 };
      hit(key, opts);
      hit(key, opts);
      const blocked = hit(key, opts);
      expect(blocked.ok).toBe(false);
      expect(blocked.remaining).toBe(0);
      reset(key);
    });

    it("returns resetIn≈windowMs on the very first hit", () => {
      const key = "t-basic-4";
      const r = hit(key, { limit: 5, windowMs: 60_000 });
      expect(r.resetIn).toBe(60_000);
      reset(key);
    });
  });

  describe("sliding window behaviour", () => {
    it("frees one slot once the oldest hit ages out", () => {
      const key = "t-slide-1";
      const opts = { limit: 2, windowMs: 1_000 };
      hit(key, opts);
      vi.advanceTimersByTime(500); // oldest hit @ t=0, second @ t=500
      hit(key, opts);
      expect(hit(key, opts).ok).toBe(false); // limit hit

      // Age out the first hit only (at t=1001).
      vi.advanceTimersByTime(501);
      const after = hit(key, opts);
      expect(after.ok).toBe(true);
      expect(after.remaining).toBe(0); // 2/2 used (the second @500 + this one)
      reset(key);
    });

    it("clears the bucket entirely after a full window passes", () => {
      const key = "t-slide-2";
      const opts = { limit: 2, windowMs: 1_000 };
      hit(key, opts);
      hit(key, opts);
      vi.advanceTimersByTime(1_001);
      const r = hit(key, opts);
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(1); // fresh window
      reset(key);
    });

    it("reports resetIn matching the oldest hit's age when blocked", () => {
      const key = "t-slide-3";
      const opts = { limit: 1, windowMs: 60_000 };
      hit(key, opts); // oldest at t=0
      vi.advanceTimersByTime(10_000);
      const blocked = hit(key, opts);
      expect(blocked.ok).toBe(false);
      expect(blocked.resetIn).toBe(50_000); // 60s - 10s
      reset(key);
    });
  });

  describe("key isolation", () => {
    it("keeps separate counters per key", () => {
      const optsA = { limit: 1, windowMs: 60_000 };
      hit("t-iso-a", optsA);
      // 'b' is an untouched bucket.
      const rB = hit("t-iso-b", optsA);
      expect(rB.ok).toBe(true);
      reset("t-iso-a");
      reset("t-iso-b");
    });

    it("does not bleed state across keys when one is exhausted", () => {
      const opts = { limit: 2, windowMs: 60_000 };
      hit("t-iso-c", opts);
      hit("t-iso-c", opts);
      expect(hit("t-iso-c", opts).ok).toBe(false);
      expect(hit("t-iso-d", opts).ok).toBe(true);
      reset("t-iso-c");
      reset("t-iso-d");
    });
  });

  describe("reset()", () => {
    it("clears a blocked key so the next hit is allowed", () => {
      const key = "t-reset-1";
      const opts = { limit: 1, windowMs: 60_000 };
      hit(key, opts);
      expect(hit(key, opts).ok).toBe(false);
      reset(key);
      expect(hit(key, opts).ok).toBe(true);
      reset(key);
    });

    it("is a no-op on an unknown key", () => {
      expect(() => reset("t-reset-unknown")).not.toThrow();
    });
  });
});

describe("rate-limit · clientIp()", () => {
  it("picks the first entry from x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIp(h)).toBe("1.2.3.4");
  });

  it("trims whitespace around the first forwarded entry", () => {
    const h = new Headers({ "x-forwarded-for": "   9.9.9.9   ,  1.1.1.1" });
    expect(clientIp(h)).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const h = new Headers({ "x-real-ip": "10.0.0.1" });
    expect(clientIp(h)).toBe("10.0.0.1");
  });

  it("prefers x-forwarded-for over x-real-ip when both are present", () => {
    const h = new Headers({
      "x-forwarded-for": "2.2.2.2",
      "x-real-ip":       "3.3.3.3",
    });
    expect(clientIp(h)).toBe("2.2.2.2");
  });

  it("returns '_unknown_' when neither header is set", () => {
    expect(clientIp(new Headers())).toBe("_unknown_");
  });

  it("accepts a Request and reads its headers", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "8.8.8.8" },
    });
    expect(clientIp(req)).toBe("8.8.8.8");
  });

  it("does not crash on an empty x-forwarded-for value", () => {
    const h = new Headers({ "x-forwarded-for": "" });
    // Empty header → falls through to x-real-ip / unknown
    expect(clientIp(h)).toBe("_unknown_");
  });
});

describe("rate-limit · retryAfterSeconds()", () => {
  it("rounds milliseconds UP to seconds", () => {
    expect(retryAfterSeconds(1_001)).toBe(2);
    expect(retryAfterSeconds(1_500)).toBe(2);
    expect(retryAfterSeconds(2_000)).toBe(2);
    expect(retryAfterSeconds(2_001)).toBe(3);
  });

  it("returns at least 1 (never zero or negative)", () => {
    expect(retryAfterSeconds(0)).toBe(1);
    expect(retryAfterSeconds(-100)).toBe(1);
  });
});
