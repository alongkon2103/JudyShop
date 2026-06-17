/**
 * Shop analytics — the data layer behind `/admin/analytics`.
 *
 * What it gives you for a chosen date range:
 *   - Headline totals: paid orders, gross revenue, average order
 *     value, unique buyer count, plus a refund counter so the admin
 *     can see "revenue at risk" beside the green numbers.
 *   - A daily series — one entry per calendar day in the range with
 *     order count + revenue — used by the timeline chart.
 *   - A per-game breakdown (orders / revenue / share-of-total / avg)
 *     so the admin can see at a glance which products carried the
 *     period.
 *   - A per-payment-method breakdown (Card vs PromptPay) for the
 *     donut chart on the same page.
 *
 * Refund accounting matches the rest of the admin: REFUNDED orders
 * are excluded from PAID totals (they fall out of `status: "PAID"`)
 * and tallied separately in the "Refunded" KPI.
 */
import { db } from "./db";
import { getSettings } from "./settings";

export type AnalyticsRange = {
  /** Inclusive start of day. */
  from: Date;
  /** Inclusive end of day — the query uses `<= toEndOfDay`. */
  to: Date;
};

export type GameStat = {
  productId: string;
  slug: string;
  name: string;
  orders: number;
  revenue: number;
  avgPerOrder: number;
  /** Share of period revenue (0–100). */
  pctOfTotal: number;
};

export type Granularity = "daily" | "monthly";

export type TimelinePoint = {
  /** ISO "YYYY-MM-DD" for daily, "YYYY-MM" for monthly. Unique key. */
  bucket: string;
  /** Human label shown on the x-axis ("5 Jun" / "Jun 2026"). */
  label: string;
  orders: number;
  revenue: number;
};

/** Legacy alias kept for callers that still import DailyPoint. */
export type DailyPoint = TimelinePoint;

export type MethodStat = {
  method: "Card" | "PromptPay";
  orders: number;
  revenue: number;
  pctOfTotal: number;
};

export type CardFeeStat = {
  /** Surcharge rate Currently configured in Settings. Used to back
   *  the per-order fee out of the stored total. */
  ratePercent: number;
  /** Total surcharge collected across all PAID card orders. Computed
   *  from current rate — accurate only when the rate hasn't been
   *  changed since the orders in this range were placed. */
  collected: number;
  /** Pre-surcharge revenue from card orders (gross − surcharge). */
  netRevenue: number;
};

export type ShopAnalytics = {
  range: AnalyticsRange;
  /** How the timeline was grouped — depends on range length. */
  granularity: Granularity;
  totals: {
    paidOrders: number;
    grossRevenue: number;
    avgPerOrder: number;
    uniqueUsernames: number;
    refundedOrders: number;
    refundedAmount: number;
  };
  /** Daily for ≤ 62-day ranges, monthly otherwise. */
  timeline: TimelinePoint[];
  byGame: GameStat[];
  byMethod: MethodStat[];
  /** Card-surcharge breakdown. Always present even when no card
   *  orders exist (rate carries the current Settings value either way
   *  so the UI can still label "Card fee 6%"). */
  cardFee: CardFeeStat;
};

// ── Date helpers ─────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function dayLabel(d: Date): string {
  return `${d.getDate()} ${MONTHS_EN[d.getMonth()]}`;
}

function monthLabel(d: Date): string {
  return `${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Walk every calendar day inclusive between from and to. */
function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const cursor = startOfDay(from);
  const limit  = startOfDay(to);
  while (cursor.getTime() <= limit.getTime()) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Walk every month inclusive between from and to. */
function eachMonth(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const limit  = new Date(to.getFullYear(),   to.getMonth(),   1);
  while (cursor.getTime() <= limit.getTime()) {
    out.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/** Pick the right axis granularity so the chart stays readable.
 *  62 days is the threshold — two full months as daily bars is fine,
 *  beyond that we roll up to one bar per month. */
function pickGranularity(from: Date, to: Date): Granularity {
  const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000);
  return days > 62 ? "monthly" : "daily";
}

// ── Range presets ────────────────────────────────────────────────

export type RangePreset =
  | "all"
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this-month"
  | "last-month"
  | "custom";

/**
 * Resolve a preset key (or explicit `from`/`to` ISO dates) to a
 * concrete range. Falls back to `all` (lifetime) if neither is given.
 *
 * `earliestOrder` is consulted only for the `all` preset — pass the
 * date of the oldest order in the database so the range covers the
 * whole shop history without manual configuration.
 */
export function resolveRange(
  preset: string | null | undefined,
  from: string | null | undefined,
  to:   string | null | undefined,
  earliestOrder: Date | null,
): { preset: RangePreset; range: AnalyticsRange } {
  // Custom takes priority if both bounds are present and valid.
  if (preset === "custom" || (from && to)) {
    const f = from ? new Date(`${from}T00:00:00`) : new Date();
    const t = to   ? new Date(`${to}T00:00:00`)   : new Date();
    if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime())) {
      return {
        preset: "custom",
        range: { from: startOfDay(f), to: endOfDay(t) },
      };
    }
  }

  const today = startOfDay(new Date());
  switch (preset) {
    case "today":
      return { preset: "today", range: { from: today, to: endOfDay(today) } };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { preset: "yesterday", range: { from: y, to: endOfDay(y) } };
    }
    case "7d": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { preset: "7d", range: { from: start, to: endOfDay(today) } };
    }
    case "30d": {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { preset: "30d", range: { from: start, to: endOfDay(today) } };
    }
    case "this-month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { preset: "this-month", range: { from: start, to: endOfDay(today) } };
    }
    case "last-month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end   = new Date(today.getFullYear(), today.getMonth(), 0); // last day of prev month
      return { preset: "last-month", range: { from: start, to: endOfDay(end) } };
    }
    case "all":
    default: {
      // Lifetime view: walk all the way back to the earliest order if
      // we have one, otherwise fall back to "today only" so an empty
      // shop doesn't render a weird year-long axis with no data.
      const from = earliestOrder ? startOfDay(earliestOrder) : today;
      return { preset: "all", range: { from, to: endOfDay(today) } };
    }
  }
}

/** Convenience for the page — single query for the oldest order in
 *  the system, used to seed the "all" preset. */
export async function getEarliestOrderDate(): Promise<Date | null> {
  const earliest = await db.order.findFirst({
    where: { status: { in: ["PAID", "REFUNDED"] } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return earliest?.createdAt ?? null;
}

// ── Core query ───────────────────────────────────────────────────

/**
 * Pull one batch of paid + refunded orders for the range and roll
 * everything up in a single pass. The query is bounded by date and
 * status, so even multi-thousand-order ranges stay snappy.
 */
export async function getShopAnalytics(range: AnalyticsRange): Promise<ShopAnalytics> {
  // We back the surcharge out of stored order totals using the
  // current rate from Settings — historical orders pay whatever rate
  // was active at checkout time, so this is an estimate when the
  // admin has changed the rate inside the analytics window.
  const settings = await getSettings();
  const cardFeeRate = settings.cardFeePercent;

  const orders = await db.order.findMany({
    where: {
      createdAt: { gte: range.from, lte: range.to },
      status:    { in: ["PAID", "REFUNDED"] },
    },
    select: {
      id:            true,
      amount:        true,
      status:        true,
      paymentMethod: true,
      username:      true,
      createdAt:     true,
      productId:     true,
      product: { select: { id: true, slug: true, nameEn: true } },
    },
  });

  // Pick chart granularity up-front, then pre-seed bins so days /
  // months with zero activity still render a tick on the axis.
  const granularity = pickGranularity(range.from, range.to);
  const timelineMap = new Map<string, TimelinePoint>();
  if (granularity === "daily") {
    for (const day of eachDay(range.from, range.to)) {
      const key = isoDate(day);
      timelineMap.set(key, { bucket: key, label: dayLabel(day), orders: 0, revenue: 0 });
    }
  } else {
    for (const month of eachMonth(range.from, range.to)) {
      const key = monthKey(month);
      timelineMap.set(key, { bucket: key, label: monthLabel(month), orders: 0, revenue: 0 });
    }
  }

  type GameAcc = {
    productId: string; slug: string; name: string;
    orders: number; revenue: number;
  };
  const gameMap   = new Map<string, GameAcc>();
  const methodMap = new Map<"Card" | "PromptPay", { orders: number; revenue: number }>([
    ["Card", { orders: 0, revenue: 0 }],
    ["PromptPay", { orders: 0, revenue: 0 }],
  ]);
  const uniqueUsers = new Set<string>();

  let paidOrders     = 0;
  let grossRevenue   = 0;
  let refundedOrders = 0;
  let refundedAmount = 0;
  let cardFeeCollected = 0;
  let cardGrossRevenue = 0;

  for (const order of orders) {
    const amount = Number(order.amount);
    const bucketKey =
      granularity === "daily"
        ? isoDate(order.createdAt)
        : monthKey(order.createdAt);

    if (order.status === "PAID") {
      paidOrders   += 1;
      grossRevenue += amount;
      uniqueUsers.add(order.username);

      // Bucket bin (the key is guaranteed to exist because we pre-
      // seeded every day/month in the chosen range).
      const bin = timelineMap.get(bucketKey);
      if (bin) {
        bin.orders  += 1;
        bin.revenue += amount;
      }

      // Per-game
      let g = gameMap.get(order.productId);
      if (!g) {
        g = {
          productId: order.product.id,
          slug:      order.product.slug,
          name:      order.product.nameEn,
          orders:    0,
          revenue:   0,
        };
        gameMap.set(order.productId, g);
      }
      g.orders  += 1;
      g.revenue += amount;

      // Per-method
      const method = order.paymentMethod === "CARD" ? "Card" : "PromptPay";
      const m = methodMap.get(method)!;
      m.orders  += 1;
      m.revenue += amount;

      // Card surcharge — back out using current rate.
      //   amount = base × (1 + rate/100)  →  fee = amount × rate / (100 + rate)
      if (method === "Card" && cardFeeRate > 0) {
        const fee = amount * cardFeeRate / (100 + cardFeeRate);
        cardFeeCollected += fee;
        cardGrossRevenue += amount;
      } else if (method === "Card") {
        cardGrossRevenue += amount;
      }
    } else {
      refundedOrders += 1;
      refundedAmount += amount;
    }
  }

  const timeline = Array.from(timelineMap.values());

  const byGame: GameStat[] = Array.from(gameMap.values())
    .map((g) => ({
      productId:   g.productId,
      slug:        g.slug,
      name:        g.name,
      orders:      g.orders,
      revenue:     g.revenue,
      avgPerOrder: g.orders > 0 ? g.revenue / g.orders : 0,
      pctOfTotal:  grossRevenue > 0 ? (g.revenue / grossRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const byMethod: MethodStat[] = Array.from(methodMap.entries())
    .map(([method, v]) => ({
      method,
      orders:     v.orders,
      revenue:    v.revenue,
      pctOfTotal: grossRevenue > 0 ? (v.revenue / grossRevenue) * 100 : 0,
    }))
    .filter((m) => m.orders > 0);

  return {
    range,
    granularity,
    totals: {
      paidOrders,
      grossRevenue,
      avgPerOrder:     paidOrders > 0 ? grossRevenue / paidOrders : 0,
      uniqueUsernames: uniqueUsers.size,
      refundedOrders,
      refundedAmount,
    },
    timeline,
    byGame,
    byMethod,
    cardFee: {
      ratePercent: cardFeeRate,
      collected:   cardFeeCollected,
      netRevenue:  cardGrossRevenue - cardFeeCollected,
    },
  };
}

// ── Formatting helpers reused across the UI ──────────────────────

export function fmtTHB(amount: number): string {
  return `฿${amount.toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export { isoDate, dayLabel };
