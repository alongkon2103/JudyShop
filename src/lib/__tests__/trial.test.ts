/**
 * Tests for `startTrial` — the "Try N minutes" flow.
 *
 * Contract:
 *   - Validates input (username trimmed; empty → invalid_username).
 *   - Validates product (exists / isActive / trialEnabled).
 *   - Rate-limits by (productId, username, 24h window) against
 *     TrialUsage, NOT against the Whitelist row (because the row gets
 *     overwritten when the customer later buys).
 *   - Refuses to overwrite a row that already grants longer access
 *     (lifetime, or expireDate further than the trial would push it).
 *   - Writes whitelist + trial-usage atomically inside one transaction.
 *   - Returns the new expiresAt as an ISO string.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db", () => ({
  db: {
    product:    { findUnique: vi.fn() },
    whitelist:  { findUnique: vi.fn(), upsert: vi.fn() },
    trialUsage: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { startTrial, clampTrialMinutes } from "../trial";
import { db } from "../db";

function makeProduct(overrides: Partial<{
  id: string;
  isActive: boolean;
  trialEnabled: boolean;
  trialMinutes: number;
}> = {}) {
  return {
    id: overrides.id ?? "prod-1",
    isActive: overrides.isActive ?? true,
    trialEnabled: overrides.trialEnabled ?? true,
    trialMinutes: overrides.trialMinutes ?? 10,
  };
}

const BASE = {
  productId: "prod-1",
  username:  "judy_player",
  ip:        "1.2.3.4",
  userAgent: "Mozilla/5.0 test",
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: transaction is a passthrough that resolves to undefined.
  vi.mocked(db.$transaction).mockResolvedValue(undefined as any);
});

// ── Input / product validation ───────────────────────────────

describe("startTrial — input validation", () => {
  it("rejects empty / whitespace username", async () => {
    expect(await startTrial({ ...BASE, username: "" })).toEqual({
      ok: false, reason: "invalid_username",
    });
    expect(await startTrial({ ...BASE, username: "   " })).toEqual({
      ok: false, reason: "invalid_username",
    });
  });

  it("does NOT hit the DB when the username is blank", async () => {
    await startTrial({ ...BASE, username: "" });
    expect(db.product.findUnique).not.toHaveBeenCalled();
  });
});

describe("startTrial — product validation", () => {
  it("returns product_not_found when no product matches", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValueOnce(null);
    expect(await startTrial(BASE)).toEqual({ ok: false, reason: "product_not_found" });
  });

  it("returns product_inactive for an inactive product", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValueOnce(
      makeProduct({ isActive: false }) as any,
    );
    expect(await startTrial(BASE)).toEqual({ ok: false, reason: "product_inactive" });
  });

  it("returns trial_disabled when the toggle is off", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValueOnce(
      makeProduct({ trialEnabled: false }) as any,
    );
    expect(await startTrial(BASE)).toEqual({ ok: false, reason: "trial_disabled" });
  });
});

// ── Rate-limit (24h) ─────────────────────────────────────────

describe("startTrial — 24h rate limit", () => {
  beforeEach(() => {
    vi.mocked(db.product.findUnique).mockResolvedValue(makeProduct() as any);
    vi.mocked(db.whitelist.findUnique).mockResolvedValue(null);
  });

  it("checks TrialUsage with a cutoff exactly 24h ago", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T12:00:00Z"));
    vi.mocked(db.trialUsage.findFirst).mockResolvedValueOnce(null);
    await startTrial(BASE);
    const args = vi.mocked(db.trialUsage.findFirst).mock.calls[0]![0]!;
    expect(args.where).toMatchObject({
      productId: "prod-1",
      username:  { equals: "judy_player", mode: "insensitive" },
      startedAt: { gte: new Date("2026-06-07T12:00:00Z") },
    });
    vi.useRealTimers();
  });

  it("rejects with rate_limited when a TrialUsage row exists in window", async () => {
    vi.mocked(db.trialUsage.findFirst).mockResolvedValueOnce({
      id: "tu-1", startedAt: new Date(),
    } as any);
    expect(await startTrial(BASE)).toEqual({ ok: false, reason: "rate_limited" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("allows the trial when no recent TrialUsage exists", async () => {
    vi.mocked(db.trialUsage.findFirst).mockResolvedValueOnce(null);
    const r = await startTrial(BASE);
    expect(r).toMatchObject({ ok: true, minutes: 10 });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

// ── Don't downgrade existing access ──────────────────────────

describe("startTrial — already_active guard", () => {
  beforeEach(() => {
    vi.mocked(db.product.findUnique).mockResolvedValue(makeProduct() as any);
    vi.mocked(db.trialUsage.findFirst).mockResolvedValue(null);
  });

  it("refuses to overwrite a lifetime whitelist", async () => {
    vi.mocked(db.whitelist.findUnique).mockResolvedValueOnce({
      productId: "prod-1", username: "judy_player",
      isLifetime: true, expireDate: null,
    } as any);
    expect(await startTrial(BASE)).toEqual({ ok: false, reason: "already_active" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses when the existing expireDate is later than the new trial expiry", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000); // 1h ahead
    vi.mocked(db.whitelist.findUnique).mockResolvedValueOnce({
      productId: "prod-1", username: "judy_player",
      isLifetime: false, expireDate: future,
    } as any);
    expect(await startTrial(BASE)).toEqual({ ok: false, reason: "already_active" });
  });

  it("ALLOWS trial when existing whitelist is already expired", async () => {
    vi.mocked(db.whitelist.findUnique).mockResolvedValueOnce({
      productId: "prod-1", username: "judy_player",
      isLifetime: false, expireDate: new Date(Date.now() - 60 * 1000),
    } as any);
    const r = await startTrial(BASE);
    expect(r).toMatchObject({ ok: true });
  });

  it("ALLOWS trial when existing expireDate equals new expiry (no strict gain, but no loss)", async () => {
    // expireDate >= newExpiry would be a loss, but the code uses strict >,
    // so equal expiries pass through.
    const trialMinutes = 10;
    const newExpiry = new Date(Date.now() + trialMinutes * 60 * 1000);
    vi.mocked(db.whitelist.findUnique).mockResolvedValueOnce({
      productId: "prod-1", username: "judy_player",
      isLifetime: false, expireDate: newExpiry,
    } as any);
    const r = await startTrial(BASE);
    expect(r.ok).toBe(true);
  });
});

// ── Atomic write ─────────────────────────────────────────────

describe("startTrial — atomic write", () => {
  beforeEach(() => {
    vi.mocked(db.product.findUnique).mockResolvedValue(makeProduct() as any);
    vi.mocked(db.trialUsage.findFirst).mockResolvedValue(null);
    vi.mocked(db.whitelist.findUnique).mockResolvedValue(null);
  });

  it("wraps the whitelist upsert + trial-usage insert in a single transaction", async () => {
    await startTrial(BASE);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.whitelist.upsert).toHaveBeenCalledTimes(1);
    expect(db.trialUsage.create).toHaveBeenCalledTimes(1);
  });

  it("sets source=TRIAL on both create and update branches of the whitelist upsert", async () => {
    await startTrial(BASE);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    expect(call.create.source).toBe("TRIAL");
    expect(call.update.source).toBe("TRIAL");
  });

  it("never marks the whitelist as lifetime — trials are time-limited", async () => {
    await startTrial(BASE);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    expect(call.create.isLifetime).toBe(false);
    expect(call.update.isLifetime).toBe(false);
    expect(call.update.expireDate).toBeInstanceOf(Date);
  });

  it("uses the product's trialMinutes to compute the expiry", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValueOnce(
      makeProduct({ trialMinutes: 25 }) as any,
    );
    const before = Date.now();
    const r = await startTrial(BASE);
    expect(r.ok).toBe(true);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    const ms = (call.create.expireDate as Date).getTime();
    expect(ms).toBeGreaterThanOrEqual(before + 25 * 60_000 - 100);
    expect(ms).toBeLessThanOrEqual(Date.now() + 25 * 60_000 + 100);
  });

  it("records ip + userAgent on the TrialUsage row", async () => {
    await startTrial(BASE);
    const call = vi.mocked(db.trialUsage.create).mock.calls[0]![0];
    expect(call.data).toMatchObject({
      productId: "prod-1",
      username:  "judy_player",
      ip:        "1.2.3.4",
      userAgent: "Mozilla/5.0 test",
    });
  });

  it("handles missing ip/userAgent as null (not undefined)", async () => {
    await startTrial({ productId: "prod-1", username: "judy_player" });
    const call = vi.mocked(db.trialUsage.create).mock.calls[0]![0];
    expect(call.data.ip).toBeNull();
    expect(call.data.userAgent).toBeNull();
  });

  it("returns expiresAt as a parseable ISO string", async () => {
    const r = await startTrial(BASE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Number.isFinite(Date.parse(r.expiresAt))).toBe(true);
    }
  });
});

// ── clampTrialMinutes ────────────────────────────────────────

describe("clampTrialMinutes", () => {
  it("returns the value unchanged when in range", () => {
    expect(clampTrialMinutes(10)).toBe(10);
    expect(clampTrialMinutes(1)).toBe(1);
    expect(clampTrialMinutes(60)).toBe(60);
  });

  it("clamps below 1 up to 1", () => {
    expect(clampTrialMinutes(0)).toBe(1);
    expect(clampTrialMinutes(-5)).toBe(1);
  });

  it("clamps above 60 down to 60", () => {
    expect(clampTrialMinutes(120)).toBe(60);
    expect(clampTrialMinutes(9999)).toBe(60);
  });

  it("rounds non-integer input", () => {
    expect(clampTrialMinutes(10.4)).toBe(10);
    expect(clampTrialMinutes(10.6)).toBe(11);
  });

  it("returns 10 (default) for NaN / Infinity input", () => {
    expect(clampTrialMinutes(Number.NaN)).toBe(10);
    expect(clampTrialMinutes(Number.POSITIVE_INFINITY)).toBe(10);
    expect(clampTrialMinutes(Number.NEGATIVE_INFINITY)).toBe(10);
  });
});
