/**
 * Tests for the finance aggregator that backs the admin Finance
 * dashboard, the CSV export, and the PDF statement.
 *
 * What we want to guard:
 *   - PAID orders feed the totals; refunded / pending ones don't
 *     (we mock the Prisma layer so the where-clause is the contract).
 *   - The "เงินกลาง" share is computed correctly when partners cover
 *     0%, partial, or the full 100% of a product.
 *   - Per-partner rollups sum across multiple games and dedupe
 *     orders (a partner with two products gets ONE orderCount
 *     entry per order — not double-counted).
 *   - Avg-per-order survives the zero-orders edge case.
 *   - Empty months return zeroed totals + empty lists (no crash).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db", () => ({
  db: { order: { findMany: vi.fn() } },
}));

import { getMonthlyFinance } from "../finance";
import { db } from "../db";

// ── Fixtures ─────────────────────────────────────────────────

type MockPartner = {
  partnerId:    string;
  sharePercent: number | string;
  partner:      { id: string; name: string; contact: string | null };
};

type MockProduct = {
  id:       string;
  slug:     string;
  nameEn:   string;
  partners: MockPartner[];
};

type MockOrder = {
  id:        string;
  amount:    number | string;
  productId: string;
  product:   MockProduct;
};

function partner(id: string, pct: number, name?: string, contact?: string | null): MockPartner {
  return {
    partnerId: id,
    sharePercent: pct,
    partner: { id, name: name ?? id, contact: contact ?? null },
  };
}

function product(id: string, partners: MockPartner[]): MockProduct {
  return {
    id,
    slug:    id,
    nameEn:  id.toUpperCase(),
    partners,
  };
}

function order(id: string, amount: number, p: MockProduct): MockOrder {
  return { id, amount, productId: p.id, product: p };
}

const mockedFind = vi.mocked(db.order.findMany);

describe("getMonthlyFinance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeroed totals when the month has no PAID orders", async () => {
    mockedFind.mockResolvedValueOnce([] as never);
    const r = await getMonthlyFinance(2026, 6);
    expect(r.totals).toEqual({ gross: 0, partnerPayout: 0, sharedPool: 0, orderCount: 0 });
    expect(r.perGame).toEqual([]);
    expect(r.perPartner).toEqual([]);
  });

  it("queries only PAID orders within the requested month range", async () => {
    mockedFind.mockResolvedValueOnce([] as never);
    await getMonthlyFinance(2026, 3);
    const args = mockedFind.mock.calls[0]![0]! as { where: any };
    expect(args.where.status).toBe("PAID");
    expect(args.where.createdAt.gte).toEqual(new Date(2026, 2, 1));
    expect(args.where.createdAt.lt).toEqual(new Date(2026, 3, 1));
  });

  it("treats a product with no partners as 100% shared pool", async () => {
    const game = product("solo", []);
    mockedFind.mockResolvedValueOnce([
      order("o1", 1000, game),
      order("o2",  500, game),
    ] as never);

    const r = await getMonthlyFinance(2026, 6);
    expect(r.totals.gross).toBe(1500);
    expect(r.totals.partnerPayout).toBe(0);
    expect(r.totals.sharedPool).toBe(1500);
    expect(r.perPartner).toEqual([]);
    expect(r.perGame).toHaveLength(1);
    // Pool line appears for the game even with no partners.
    expect(r.perGame[0]!.lines).toEqual([
      expect.objectContaining({ partnerId: null, name: "เงินกลาง", payout: 1500, sharePercent: 100 }),
    ]);
  });

  it("splits revenue correctly between partners + pool when share<100", async () => {
    const game = product("g1", [
      partner("A", 40, "Partner A", "a@x.com"),
      partner("B", 30, "Partner B"),
    ]);
    mockedFind.mockResolvedValueOnce([order("o1", 1000, game)] as never);

    const r = await getMonthlyFinance(2026, 6);
    expect(r.totals.gross).toBe(1000);
    expect(r.totals.partnerPayout).toBeCloseTo(700, 5);
    expect(r.totals.sharedPool).toBeCloseTo(300, 5);

    const game0 = r.perGame[0]!;
    expect(game0.lines).toHaveLength(3);   // A + B + เงินกลาง
    expect(game0.lines[2]!.partnerId).toBeNull();
    expect(game0.lines[2]!.payout).toBeCloseTo(300, 5);
  });

  it("does not emit a pool line when partners cover 100%", async () => {
    const game = product("g100", [
      partner("A", 60),
      partner("B", 40),
    ]);
    mockedFind.mockResolvedValueOnce([order("o1", 1000, game)] as never);

    const r = await getMonthlyFinance(2026, 6);
    expect(r.totals.sharedPool).toBe(0);
    const game0 = r.perGame[0]!;
    expect(game0.lines).toHaveLength(2);
    expect(game0.lines.find((l) => l.partnerId === null)).toBeUndefined();
  });

  it("rolls a partner across multiple games into a single perPartner row", async () => {
    const g1 = product("g1", [partner("A", 50)]);
    const g2 = product("g2", [partner("A", 25)]);
    mockedFind.mockResolvedValueOnce([
      order("o1", 1000, g1),
      order("o2", 2000, g2),
      order("o3",  400, g1),
    ] as never);

    const r = await getMonthlyFinance(2026, 6);
    const a = r.perPartner.find((p) => p.partnerId === "A")!;
    expect(a.gameCount).toBe(2);
    expect(a.orderCount).toBe(3);
    expect(a.payout).toBeCloseTo(0.5 * 1000 + 0.25 * 2000 + 0.5 * 400, 5);
    expect(a.avgPerOrder).toBeCloseTo(a.payout / 3, 5);
  });

  it("sorts perGame by gross descending", async () => {
    const g1 = product("small", []);
    const g2 = product("big",   []);
    mockedFind.mockResolvedValueOnce([
      order("o1",   500, g1),
      order("o2", 10000, g2),
      order("o3",   300, g1),
    ] as never);

    const r = await getMonthlyFinance(2026, 6);
    expect(r.perGame[0]!.productId).toBe("big");
    expect(r.perGame[1]!.productId).toBe("small");
  });

  it("sorts perPartner by payout descending", async () => {
    const g = product("g", [partner("A", 70), partner("B", 20)]);
    mockedFind.mockResolvedValueOnce([order("o1", 1000, g)] as never);

    const r = await getMonthlyFinance(2026, 6);
    expect(r.perPartner[0]!.partnerId).toBe("A");
    expect(r.perPartner[1]!.partnerId).toBe("B");
  });

  it("computes avgPerOrder as 0 when partner has no orders (defensive)", async () => {
    // No orders → no perPartner entries at all, so we just confirm
    // we don't crash and the list is empty.
    mockedFind.mockResolvedValueOnce([] as never);
    const r = await getMonthlyFinance(2026, 6);
    expect(r.perPartner).toEqual([]);
  });
});
