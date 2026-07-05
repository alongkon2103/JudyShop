/**
 * Tests for the partner-scoped revenue view behind the /partner portal.
 *
 * The load-bearing guarantees here are BOTH correctness and security:
 *   - Every query is scoped to the partner (where.product.partners.some
 *     .partnerId) and only that partner's share row is selected — a
 *     partner can never pull another owner's orders or slice.
 *   - payout = amount × share% / 100, aggregated per game.
 *   - A missing share row degrades to 0% (defensive), never crashes.
 *   - The 6-month trend is chronological, crosses the year boundary, and
 *     sums only the partner's slice.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db", () => ({
  db: { order: { findMany: vi.fn() } },
}));

import {
  getPartnerMonthlyFinance,
  getPartnerSixMonthTrend,
  getPartnerDailyPayoutSeries,
} from "../partner-finance";
import { db } from "../db";

type MockPartnerRow = {
  partnerId: string;
  sharePercent: number | string;
  partner: { name: string };
};

type MockOrder = {
  id: string;
  amount: number | string;
  product: {
    id: string;
    slug: string;
    nameEn: string;
    partners: MockPartnerRow[];
  };
};

/** Single-owner order for the queried partner ("P1" by default). */
function order(
  id: string,
  amount: number,
  productId: string,
  sharePercent: number,
  partnerId = "P1",
): MockOrder {
  return {
    id,
    amount,
    product: {
      id: productId,
      slug: productId,
      nameEn: productId.toUpperCase(),
      partners: [
        { partnerId, sharePercent, partner: { name: `Partner ${partnerId}` } },
      ],
    },
  };
}

const mockedFind = vi.mocked(db.order.findMany);

describe("getPartnerMonthlyFinance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeroed totals for a month with no orders", async () => {
    mockedFind.mockResolvedValueOnce([] as never);
    const r = await getPartnerMonthlyFinance("P1", 2026, 6);
    expect(r.totalPayout).toBe(0);
    expect(r.totalOrders).toBe(0);
    expect(r.totalGross).toBe(0);
    expect(r.perGame).toEqual([]);
    expect(r.monthKey).toBe("2026-06");
  });

  it("scopes the query to PAID in-month orders of the partner's products", async () => {
    mockedFind.mockResolvedValueOnce([] as never);
    await getPartnerMonthlyFinance("P1", 2026, 3);

    const args = mockedFind.mock.calls[0]![0]! as { where: any; select: any };
    expect(args.where.status).toBe("PAID");
    expect(args.where.createdAt.gte).toEqual(new Date(2026, 2, 1));
    expect(args.where.createdAt.lt).toEqual(new Date(2026, 3, 1));
    // Security contract — only this partner's products…
    expect(args.where.product.partners.some.partnerId).toBe("P1");
    // …but within those games the monthly view now fetches every recipient
    // (name + share) so the card can show the full split. No where-narrowing.
    expect(args.select.product.select.partners.where).toBeUndefined();
    expect(args.select.product.select.partners.select.partner.select.name).toBe(true);
  });

  it("computes payout = amount × share% and aggregates per game", async () => {
    mockedFind.mockResolvedValueOnce([
      order("o1", 1000, "g1", 40),
      order("o2", 500, "g1", 40),
      order("o3", 2000, "g2", 25),
    ] as never);

    const r = await getPartnerMonthlyFinance("P1", 2026, 6);
    expect(r.totalGross).toBe(3500);
    expect(r.totalOrders).toBe(3);
    // 1500 × 0.40 + 2000 × 0.25 = 600 + 500
    expect(r.totalPayout).toBeCloseTo(1100, 5);

    expect(r.perGame).toHaveLength(2);
    // Sorted by payout desc → g1 (600) before g2 (500).
    const g1 = r.perGame[0]!;
    expect(g1.productId).toBe("g1");
    expect(g1.gross).toBe(1500);
    expect(g1.orderCount).toBe(2);
    expect(g1.sharePercent).toBe(40);
    expect(g1.payout).toBeCloseTo(600, 5);
    expect(r.perGame[1]!.productId).toBe("g2");
    expect(r.perGame[1]!.payout).toBeCloseTo(500, 5);
  });

  it("exposes the full recipient split per game (others + shared pool)", async () => {
    // g1 owned by P1 (20%) + P2 (30%) → 50% left is the shared pool.
    const multi: MockOrder = {
      id: "o1",
      amount: 1000,
      product: {
        id: "g1",
        slug: "g1",
        nameEn: "G1",
        partners: [
          { partnerId: "P1", sharePercent: 20, partner: { name: "Partner A" } },
          { partnerId: "P2", sharePercent: 30, partner: { name: "Partner B" } },
        ],
      },
    };
    mockedFind.mockResolvedValueOnce([multi] as never);

    const r = await getPartnerMonthlyFinance("P1", 2026, 6);
    const g = r.perGame[0]!;
    // The viewer's own totals stay their slice only.
    expect(g.sharePercent).toBe(20);
    expect(g.payout).toBeCloseTo(200, 5);

    const byKey = Object.fromEntries(
      g.recipients.map((x) => [x.partnerId ?? "pool", x]),
    );
    expect(byKey["P1"]!.payout).toBeCloseTo(200, 5);
    expect(byKey["P1"]!.isYou).toBe(true);
    expect(byKey["P2"]!.name).toBe("Partner B");
    expect(byKey["P2"]!.payout).toBeCloseTo(300, 5);
    expect(byKey["P2"]!.isYou).toBe(false);
    // Shared pool = remaining 50%.
    expect(byKey["pool"]!.sharePercent).toBeCloseTo(50, 5);
    expect(byKey["pool"]!.payout).toBeCloseTo(500, 5);
    expect(byKey["pool"]!.isYou).toBe(false);
    // Sorted by payout desc: pool (500) → P2 (300) → P1 (200).
    expect(g.recipients.map((x) => x.partnerId)).toEqual([null, "P2", "P1"]);
  });

  it("omits the shared pool when partner shares sum to 100%", async () => {
    const full: MockOrder = {
      id: "o1",
      amount: 1000,
      product: {
        id: "g1",
        slug: "g1",
        nameEn: "G1",
        partners: [
          { partnerId: "P1", sharePercent: 60, partner: { name: "Partner A" } },
          { partnerId: "P2", sharePercent: 40, partner: { name: "Partner B" } },
        ],
      },
    };
    mockedFind.mockResolvedValueOnce([full] as never);

    const r = await getPartnerMonthlyFinance("P1", 2026, 6);
    const g = r.perGame[0]!;
    expect(g.recipients.some((x) => x.partnerId === null)).toBe(false);
    expect(g.recipients).toHaveLength(2);
  });

  it("degrades a missing share row to 0% instead of crashing", async () => {
    const orphan: MockOrder = {
      id: "o1",
      amount: 1000,
      product: { id: "g", slug: "g", nameEn: "G", partners: [] },
    };
    mockedFind.mockResolvedValueOnce([orphan] as never);

    const r = await getPartnerMonthlyFinance("P1", 2026, 6);
    expect(r.totalGross).toBe(1000);
    expect(r.totalPayout).toBe(0);
    expect(r.perGame[0]!.sharePercent).toBe(0);
  });
});

describe("getPartnerSixMonthTrend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 6 chronological points ending at the given month, each scoped", async () => {
    mockedFind.mockResolvedValue([] as never);
    const points = await getPartnerSixMonthTrend("P1", 2026, 6);

    expect(points.map((p) => p.monthKey)).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
    ]);
    // Every monthly query stays scoped to the partner.
    for (const call of mockedFind.mock.calls) {
      const where = (call[0] as any).where;
      expect(where.status).toBe("PAID");
      expect(where.product.partners.some.partnerId).toBe("P1");
    }
  });

  it("crosses the year boundary correctly", async () => {
    mockedFind.mockResolvedValue([] as never);
    const points = await getPartnerSixMonthTrend("P1", 2026, 2);
    expect(points.map((p) => p.monthKey)).toEqual([
      "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02",
    ]);
  });

  it("sums only the partner's slice per month (trend)", async () => {
    // 6 monthly queries; only the last (current month) has orders.
    mockedFind
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        order("o1", 1000, "g", 30),
        order("o2", 500, "g", 30),
      ] as never);

    const points = await getPartnerSixMonthTrend("P1", 2026, 6);
    expect(points[0]!.payout).toBe(0);
    expect(points[5]!.payout).toBeCloseTo(450, 5); // 1500 × 0.30
    expect(points[5]!.label).toBe("Jun 2026");
  });
});

describe("getPartnerDailyPayoutSeries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns one zero-filled bucket per day, scoped to the partner's share", async () => {
    mockedFind.mockResolvedValueOnce([] as never);
    const s = await getPartnerDailyPayoutSeries("P1", 30);

    expect(s).toHaveLength(30);
    expect(s.every((p) => p.revenue === 0 && p.orders === 0)).toBe(true);

    const args = mockedFind.mock.calls[0]![0]! as { where: any; select: any };
    expect(args.where.status).toBe("PAID");
    expect(args.where.product.partners.some.partnerId).toBe("P1");
    // Series is the partner's payout → only their share row is selected.
    expect(args.select.product.select.partners.where.partnerId).toBe("P1");
  });

  it("buckets an order as the partner's payout (amount × share)", async () => {
    // createdAt = now → lands in the last (today) bucket, inside the window.
    const now = new Date();
    mockedFind.mockResolvedValueOnce([
      { amount: 1000, createdAt: now, product: { partners: [{ sharePercent: 30 }] } },
      { amount: 500, createdAt: now, product: { partners: [{ sharePercent: 30 }] } },
    ] as never);

    const s = await getPartnerDailyPayoutSeries("P1", 30);
    const totalRevenue = s.reduce((a, p) => a + p.revenue, 0);
    const totalOrders = s.reduce((a, p) => a + p.orders, 0);
    expect(totalRevenue).toBeCloseTo(450, 5); // 1500 × 0.30
    expect(totalOrders).toBe(2);
    expect(s[s.length - 1]!.orders).toBe(2); // today's bucket
  });

  it("respects a custom window length", async () => {
    mockedFind.mockResolvedValueOnce([] as never);
    const s = await getPartnerDailyPayoutSeries("P1", 7);
    expect(s).toHaveLength(7);
  });
});
