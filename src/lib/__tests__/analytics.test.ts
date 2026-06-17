/**
 * Tests for the shop analytics aggregator behind /admin/analytics.
 *
 * What we want to guard:
 *   - PAID orders feed the green numbers; REFUNDED ones land in the
 *     refund counter only (no double-count).
 *   - Daily granularity is chosen when the range is short; we flip
 *     to monthly buckets once the range gets long (62 day threshold).
 *   - Per-game and per-method breakdowns sort + total correctly.
 *   - Range presets resolve to the right windows (today is just
 *     today, 7d is 7 days inclusive, etc.).
 *   - "all" falls back to the earliest order date, or to today when
 *     the shop has never seen an order.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db", () => ({
  db: {
    order: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

// Stub the settings lookup — every test gets a fresh mocked value via
// `mockResolvedValueOnce`. Default returns 0% so existing assertions
// that don't care about card fee aren't accidentally affected.
vi.mock("../settings", () => ({
  getSettings: vi.fn(() => Promise.resolve({ cardFeePercent: 0 })),
}));

import {
  getShopAnalytics,
  resolveRange,
  getEarliestOrderDate,
} from "../analytics";
import { db } from "../db";
import { getSettings } from "../settings";

const findMany  = vi.mocked(db.order.findMany);
const findFirst = vi.mocked(db.order.findFirst);
const mockedGetSettings = vi.mocked(getSettings);

// ── Fixtures ─────────────────────────────────────────────────

function order(opts: {
  id?: string;
  amount: number;
  status?: "PAID" | "REFUNDED";
  method?: "CARD" | "PROMPTPAY";
  username?: string;
  createdAt: Date;
  productId?: string;
  productName?: string;
  productSlug?: string;
}) {
  return {
    id:            opts.id ?? `o-${opts.amount}`,
    amount:        opts.amount,
    status:        opts.status ?? "PAID",
    paymentMethod: opts.method ?? "CARD",
    username:      opts.username ?? "user1",
    createdAt:     opts.createdAt,
    productId:     opts.productId ?? "p1",
    product: {
      id:     opts.productId ?? "p1",
      slug:   opts.productSlug ?? "judy-legend",
      nameEn: opts.productName ?? "Judy Legend",
    },
  };
}

// ── resolveRange ────────────────────────────────────────────

describe("resolveRange", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to 'all' when no preset and no custom dates are given", () => {
    const earliest = new Date(2025, 0, 15); // 15 Jan 2025
    const r = resolveRange(undefined, undefined, undefined, earliest);
    expect(r.preset).toBe("all");
    expect(r.range.from.getTime()).toBe(new Date(2025, 0, 15, 0, 0, 0, 0).getTime());
  });

  it("'all' with no earliest order pins the range to today only", () => {
    const r = resolveRange("all", null, null, null);
    expect(r.preset).toBe("all");
    expect(r.range.from.toDateString()).toBe(new Date().toDateString());
  });

  it("'today' returns the current day's bounds", () => {
    const r = resolveRange("today", null, null, null);
    expect(r.preset).toBe("today");
    const t = new Date();
    expect(r.range.from.getDate()).toBe(t.getDate());
    expect(r.range.to.getDate()).toBe(t.getDate());
  });

  it("'7d' covers the last 7 calendar days inclusive", () => {
    const r = resolveRange("7d", null, null, null);
    const days = Math.floor((r.range.to.getTime() - r.range.from.getTime()) / 86_400_000);
    // From midnight 7 days ago through end of today → exactly 6 full days + part of day 7.
    expect(days).toBe(6);
  });

  it("custom from + to wins even without 'custom' preset key", () => {
    const r = resolveRange(undefined, "2026-03-01", "2026-03-31", null);
    expect(r.preset).toBe("custom");
    expect(r.range.from.getMonth()).toBe(2);   // March
    expect(r.range.to.getDate()).toBe(31);
  });
});

// ── getEarliestOrderDate ────────────────────────────────────

describe("getEarliestOrderDate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the createdAt of the oldest PAID-or-REFUNDED order", async () => {
    const old = new Date(2025, 5, 12);
    findFirst.mockResolvedValueOnce({ createdAt: old } as never);
    const d = await getEarliestOrderDate();
    expect(d?.getTime()).toBe(old.getTime());
  });

  it("returns null when the shop has never seen an order", async () => {
    findFirst.mockResolvedValueOnce(null as never);
    const d = await getEarliestOrderDate();
    expect(d).toBeNull();
  });
});

// ── getShopAnalytics ────────────────────────────────────────

describe("getShopAnalytics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns zeroed totals when no orders exist in range", async () => {
    findMany.mockResolvedValueOnce([] as never);
    const r = await getShopAnalytics({
      from: new Date(2026, 5, 1, 0, 0, 0, 0),
      to:   new Date(2026, 5, 5, 23, 59, 59, 999),
    });
    expect(r.totals.paidOrders).toBe(0);
    expect(r.totals.grossRevenue).toBe(0);
    expect(r.byGame).toEqual([]);
    expect(r.byMethod).toEqual([]);
    // 5-day window → 5 daily bins, each zero.
    expect(r.granularity).toBe("daily");
    expect(r.timeline).toHaveLength(5);
    expect(r.timeline.every((p) => p.orders === 0 && p.revenue === 0)).toBe(true);
  });

  it("aggregates PAID orders and excludes refunded amounts from totals", async () => {
    const d1 = new Date(2026, 5, 10);
    const d2 = new Date(2026, 5, 11);
    findMany.mockResolvedValueOnce([
      order({ amount: 100,  status: "PAID",     createdAt: d1, username: "alice" }),
      order({ amount: 200,  status: "PAID",     createdAt: d1, username: "alice" }),
      order({ amount: 300,  status: "PAID",     createdAt: d2, username: "bob"   }),
      order({ amount: 1000, status: "REFUNDED", createdAt: d1, username: "carol" }),
    ] as never);

    const r = await getShopAnalytics({
      from: new Date(2026, 5, 10, 0, 0, 0, 0),
      to:   new Date(2026, 5, 11, 23, 59, 59, 999),
    });

    expect(r.totals.paidOrders).toBe(3);
    expect(r.totals.grossRevenue).toBe(600);
    expect(r.totals.avgPerOrder).toBe(200);
    expect(r.totals.uniqueUsernames).toBe(2);     // alice + bob (carol refunded)
    expect(r.totals.refundedOrders).toBe(1);
    expect(r.totals.refundedAmount).toBe(1000);
  });

  it("sorts per-game by revenue descending", async () => {
    const d = new Date(2026, 5, 10);
    findMany.mockResolvedValueOnce([
      order({ amount: 500,  createdAt: d, productId: "small", productName: "Small", productSlug: "small" }),
      order({ amount: 8000, createdAt: d, productId: "big",   productName: "Big",   productSlug: "big" }),
    ] as never);
    const r = await getShopAnalytics({
      from: new Date(2026, 5, 10, 0, 0, 0, 0),
      to:   new Date(2026, 5, 10, 23, 59, 59, 999),
    });
    expect(r.byGame[0]!.productId).toBe("big");
    expect(r.byGame[1]!.productId).toBe("small");
    expect(r.byGame[0]!.pctOfTotal).toBeCloseTo((8000 / 8500) * 100, 5);
  });

  it("groups by Card vs PromptPay and excludes empty methods", async () => {
    const d = new Date(2026, 5, 10);
    findMany.mockResolvedValueOnce([
      order({ amount: 1000, method: "CARD",      createdAt: d }),
      order({ amount: 500,  method: "PROMPTPAY", createdAt: d }),
    ] as never);
    const r = await getShopAnalytics({
      from: new Date(2026, 5, 10, 0, 0, 0, 0),
      to:   new Date(2026, 5, 10, 23, 59, 59, 999),
    });
    const card  = r.byMethod.find((m) => m.method === "Card")!;
    const promp = r.byMethod.find((m) => m.method === "PromptPay")!;
    expect(card.revenue).toBe(1000);
    expect(promp.revenue).toBe(500);
  });

  it("switches to monthly granularity for ranges longer than 62 days", async () => {
    findMany.mockResolvedValueOnce([] as never);
    const r = await getShopAnalytics({
      from: new Date(2026, 0, 1, 0, 0, 0, 0),
      to:   new Date(2026, 5, 30, 23, 59, 59, 999),
    });
    expect(r.granularity).toBe("monthly");
    // Jan..Jun = 6 month buckets pre-seeded.
    expect(r.timeline.length).toBe(6);
  });

  it("backs the card surcharge out of stored totals using the current rate", async () => {
    // Customer paid ฿1060 on a card with a 6% surcharge — base was
    // ฿1000, so the surcharge slice we expect to recover is ฿60.
    mockedGetSettings.mockResolvedValueOnce({ cardFeePercent: 6 } as never);
    const d = new Date(2026, 5, 10);
    findMany.mockResolvedValueOnce([
      order({ amount: 1060, method: "CARD",      createdAt: d }),
      order({ amount: 500,  method: "PROMPTPAY", createdAt: d }),
    ] as never);

    const r = await getShopAnalytics({
      from: new Date(2026, 5, 10, 0, 0, 0, 0),
      to:   new Date(2026, 5, 10, 23, 59, 59, 999),
    });
    expect(r.cardFee.ratePercent).toBe(6);
    // fee = 1060 × 6 / 106 = 60
    expect(r.cardFee.collected).toBeCloseTo(60, 5);
    expect(r.cardFee.netRevenue).toBeCloseTo(1000, 5);
  });

  it("reports the rate even when no card orders fall in range", async () => {
    mockedGetSettings.mockResolvedValueOnce({ cardFeePercent: 3.5 } as never);
    findMany.mockResolvedValueOnce([] as never);
    const r = await getShopAnalytics({
      from: new Date(2026, 5, 10, 0, 0, 0, 0),
      to:   new Date(2026, 5, 10, 23, 59, 59, 999),
    });
    expect(r.cardFee.ratePercent).toBe(3.5);
    expect(r.cardFee.collected).toBe(0);
    expect(r.cardFee.netRevenue).toBe(0);
  });
});
