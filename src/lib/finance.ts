/**
 * Revenue-share aggregation for the finance dashboard.
 *
 * Inputs: a calendar month + the universe of PAID orders inside it.
 * Outputs: two breakdowns (per game, per partner) plus a 6-month
 * trend series used for the bar chart.
 *
 * Concept "เงินกลาง" — the leftover share (100 − Σ partners) for any
 * given product is implicitly the house's. We never store it as a
 * row; it's computed per order and surfaced as a synthetic entry in
 * the response so the dashboard / PDF can render it as a line item
 * alongside real partners.
 *
 * Only orders with `status === "PAID"` are counted. Refunds simply
 * mutate the order's status to REFUNDED, so they fall out of the
 * filter on the next render — which matches the agreed business
 * rule that monthly statements aren't frozen.
 *
 * All money is stored as Prisma Decimal in the DB; we keep numbers
 * as JS `number` here because monthly turnover is bounded and the
 * float precision of THB (with at most 2 decimals) stays well inside
 * the safe integer range after multiplying by 100 for satang math.
 */
import { db } from "./db";

export type PartnerEarning = {
  partnerId: string;
  name: string;
  contact: string | null;
  /** Total ฿ from this partner's share across every game this month. */
  payout: number;
  /** How many distinct products contributed to that payout. */
  gameCount: number;
  /** How many PAID orders rolled into the payout (cross-game sum). */
  orderCount: number;
  /** payout / orderCount, useful in the table. 0 if no orders. */
  avgPerOrder: number;
  /** Sum of order.amount × the partner's share% across all their games. */
  grossContribution: number;
};

export type GamePartnerLine = {
  partnerId: string | null;     // null = shared pool ("เงินกลาง")
  name: string;
  contact: string | null;
  sharePercent: number;
  payout: number;
};

export type GameBreakdown = {
  productId: string;
  slug: string;
  name: string;
  /** Gross ฿ for this game this month (sum of paid order amounts). */
  gross: number;
  orderCount: number;
  avgPerOrder: number;
  /** Partner lines + the synthetic "เงินกลาง" line at the end (if > 0). */
  lines: GamePartnerLine[];
};

export type MonthlyFinance = {
  monthKey: string;            // "2026-06"
  monthStart: Date;
  monthEnd: Date;              // exclusive
  totals: {
    gross: number;
    partnerPayout: number;
    sharedPool: number;
    orderCount: number;
  };
  perGame: GameBreakdown[];
  perPartner: PartnerEarning[];
};

export type TrendPoint = {
  monthKey: string;            // "2026-06"
  label: string;               // "Jun 2026"
  gross: number;
  partnerPayout: number;
  sharedPool: number;
};

// ── Date helpers ─────────────────────────────────────────────────

/** First day of the month at 00:00 local. */
function startOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

/** First day of the NEXT month at 00:00 local (exclusive upper bound). */
function startOfNextMonth(year: number, month: number): Date {
  return new Date(year, month, 1, 0, 0, 0, 0);
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Parse "YYYY-MM" → { year, month }. Returns current month on failure. */
export function parseMonthKey(input: string | null | undefined): {
  year: number;
  month: number;
} {
  if (input) {
    const m = /^(\d{4})-(\d{1,2})$/.exec(input);
    if (m) {
      const year  = Number(m[1]);
      const month = Number(m[2]);
      if (month >= 1 && month <= 12) return { year, month };
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

// ── Core aggregation ─────────────────────────────────────────────

/**
 * Aggregate one calendar month into the finance breakdown.
 *
 * The query joins Order → Product → ProductPartner → Partner in one
 * round-trip; the math is then a single pass over the orders.
 */
export async function getMonthlyFinance(
  year: number,
  month: number,
): Promise<MonthlyFinance> {
  const monthStart = startOfMonth(year, month);
  const monthEnd   = startOfNextMonth(year, month);

  const orders = await db.order.findMany({
    where: {
      status:    "PAID",
      createdAt: { gte: monthStart, lt: monthEnd },
    },
    select: {
      id:        true,
      amount:    true,
      productId: true,
      product: {
        select: {
          id:     true,
          slug:   true,
          nameEn: true,
          partners: {
            select: {
              partnerId:    true,
              sharePercent: true,
              partner:      { select: { id: true, name: true, contact: true } },
            },
          },
        },
      },
    },
  });

  // ── Game-level accumulators ──────────────────────────────────────
  type GameAcc = {
    productId: string;
    slug: string;
    name: string;
    gross: number;
    orderCount: number;
    lines: Map<string, GamePartnerLine>;  // key = partnerId
    poolPayout: number;
    poolSharePct: number;
  };
  const perGameMap = new Map<string, GameAcc>();

  // ── Partner-level accumulators ───────────────────────────────────
  type PartnerAcc = PartnerEarning & { games: Set<string>; orders: Set<string> };
  const perPartnerMap = new Map<string, PartnerAcc>();

  let totalGross         = 0;
  let totalPartnerPayout = 0;
  let totalSharedPool    = 0;

  for (const order of orders) {
    const amount = Number(order.amount);
    totalGross += amount;

    const product = order.product;
    let game = perGameMap.get(product.id);
    if (!game) {
      game = {
        productId: product.id,
        slug:      product.slug,
        name:      product.nameEn,
        gross:     0,
        orderCount: 0,
        lines:     new Map(),
        poolPayout: 0,
        poolSharePct: 100,
      };
      perGameMap.set(product.id, game);
    }
    game.gross      += amount;
    game.orderCount += 1;

    const allocatedPct = product.partners.reduce(
      (s, p) => s + Number(p.sharePercent),
      0,
    );
    game.poolSharePct = Math.max(0, 100 - allocatedPct);

    // Distribute to each partner
    for (const ps of product.partners) {
      const pct = Number(ps.sharePercent);
      const slice = amount * (pct / 100);
      totalPartnerPayout += slice;

      // Game-level line
      let line = game.lines.get(ps.partnerId);
      if (!line) {
        line = {
          partnerId:    ps.partnerId,
          name:         ps.partner.name,
          contact:      ps.partner.contact,
          sharePercent: pct,
          payout:       0,
        };
        game.lines.set(ps.partnerId, line);
      }
      line.payout += slice;

      // Partner-level rollup
      let pacc = perPartnerMap.get(ps.partnerId);
      if (!pacc) {
        pacc = {
          partnerId:         ps.partnerId,
          name:              ps.partner.name,
          contact:           ps.partner.contact,
          payout:            0,
          gameCount:         0,
          orderCount:        0,
          avgPerOrder:       0,
          grossContribution: 0,
          games:             new Set(),
          orders:            new Set(),
        };
        perPartnerMap.set(ps.partnerId, pacc);
      }
      pacc.payout            += slice;
      pacc.grossContribution += amount;     // gross of orders they touched
      pacc.games.add(product.id);
      pacc.orders.add(order.id);
    }

    // Shared pool — leftover slice goes here.
    const poolPct   = Math.max(0, 100 - allocatedPct);
    const poolSlice = amount * (poolPct / 100);
    totalSharedPool   += poolSlice;
    game.poolPayout   += poolSlice;
  }

  // ── Finalise per-game (sort by gross desc, append pool line) ─────
  const perGame: GameBreakdown[] = Array.from(perGameMap.values())
    .map((g): GameBreakdown => {
      const lines: GamePartnerLine[] = Array.from(g.lines.values()).sort(
        (a, b) => b.payout - a.payout,
      );
      if (g.poolPayout > 0 || g.poolSharePct > 0) {
        lines.push({
          partnerId:    null,
          name:         "เงินกลาง",
          contact:      null,
          sharePercent: g.poolSharePct,
          payout:       g.poolPayout,
        });
      }
      return {
        productId:   g.productId,
        slug:        g.slug,
        name:        g.name,
        gross:       g.gross,
        orderCount:  g.orderCount,
        avgPerOrder: g.orderCount > 0 ? g.gross / g.orderCount : 0,
        lines,
      };
    })
    .sort((a, b) => b.gross - a.gross);

  // ── Finalise per-partner (sort by payout desc) ───────────────────
  const perPartner: PartnerEarning[] = Array.from(perPartnerMap.values())
    .map((p): PartnerEarning => ({
      partnerId:         p.partnerId,
      name:              p.name,
      contact:           p.contact,
      payout:            p.payout,
      gameCount:         p.games.size,
      orderCount:        p.orders.size,
      avgPerOrder:       p.orders.size > 0 ? p.payout / p.orders.size : 0,
      grossContribution: p.grossContribution,
    }))
    .sort((a, b) => b.payout - a.payout);

  return {
    monthKey:   monthKey(year, month),
    monthStart,
    monthEnd,
    totals: {
      gross:         totalGross,
      partnerPayout: totalPartnerPayout,
      sharedPool:    totalSharedPool,
      orderCount:    orders.length,
    },
    perGame,
    perPartner,
  };
}

// ── 6-month trend for the bar chart ──────────────────────────────

const MONTH_LABELS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Lightweight 6-month series for the trend bar chart. Each datapoint
 * carries Gross + Partner Payout + Shared Pool so the chart can stack
 * or group as needed.
 */
export async function getSixMonthTrend(
  year: number,
  month: number,
): Promise<TrendPoint[]> {
  const points: TrendPoint[] = [];
  for (let offset = 5; offset >= 0; offset--) {
    // Walk back `offset` months from the selected month.
    let y = year;
    let m = month - offset;
    while (m <= 0) { m += 12; y -= 1; }

    const start = startOfMonth(y, m);
    const end   = startOfNextMonth(y, m);
    const orders = await db.order.findMany({
      where: {
        status:    "PAID",
        createdAt: { gte: start, lt: end },
      },
      select: {
        amount:  true,
        product: {
          select: {
            partners: { select: { sharePercent: true } },
          },
        },
      },
    });

    let gross = 0;
    let payout = 0;
    let pool = 0;
    for (const o of orders) {
      const amount = Number(o.amount);
      const allocPct = o.product.partners.reduce((s, p) => s + Number(p.sharePercent), 0);
      gross  += amount;
      payout += amount * (allocPct / 100);
      pool   += amount * (Math.max(0, 100 - allocPct) / 100);
    }

    points.push({
      monthKey:      monthKey(y, m),
      label:         `${MONTH_LABELS_EN[m - 1]} ${y}`,
      gross,
      partnerPayout: payout,
      sharedPool:    pool,
    });
  }
  return points;
}

// ── Currency formatting (server-side reuse) ──────────────────────

export function fmtTHB(amount: number): string {
  return `฿${amount.toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
