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

export type MethodLabel = "Card" | "PromptPay" | "PayPal";

export type MethodStat = {
  method: MethodLabel;
  orders: number;
  revenue: number;
  pctOfTotal: number;
};

/**
 * Surcharge breakdown — used for both card and PayPal. We back out
 * the per-order fee from the stored total using the CURRENT rate from
 * Settings, so historical orders are approximate when the admin has
 * changed the rate inside the analytics window.
 */
export type FeeBreakdownStat = {
  ratePercent: number;
  collected: number;
  netRevenue: number;
};

/** Kept for backwards compat with the existing UI binding. */
export type CardFeeStat = FeeBreakdownStat;

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
  cardFee: FeeBreakdownStat;
  /** PayPal-surcharge breakdown. Same semantics as cardFee. */
  paypalFee: FeeBreakdownStat;
};

// ── Date helpers ─────────────────────────────────────────────────

/**
 * The shop runs on Bangkok time (UTC+7, no DST), but the production
 * server clock is UTC. Bucketing orders by the *server's* calendar day
 * pushed Thai early-morning orders (00:00–07:00) onto the previous day
 * on the live site — that's the "ยอดผิดวัน" the admin sees. Every day /
 * month boundary below is therefore derived in Asia/Bangkok via a fixed
 * +7h offset, so the charts are correct no matter the host timezone.
 */
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** An instant's Bangkok wall-clock parts, regardless of server TZ. */
function bkkParts(d: Date): { year: number; month: number; day: number } {
  const s = new Date(d.getTime() + BKK_OFFSET_MS);
  return { year: s.getUTCFullYear(), month: s.getUTCMonth(), day: s.getUTCDate() };
}

/** UTC instant of Bangkok-midnight that starts the given Bangkok date. */
function bkkInstant(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - BKK_OFFSET_MS);
}

/** Parse a "YYYY-MM-DD" Bangkok date (from <input type=date>) to its
 *  midnight UTC instant. Returns null when the string isn't an ISO date. */
function parseBkkDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return bkkInstant(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function startOfDay(d: Date): Date {
  const p = bkkParts(d);
  return bkkInstant(p.year, p.month, p.day);
}

function endOfDay(d: Date): Date {
  const p = bkkParts(d);
  return new Date(bkkInstant(p.year, p.month, p.day + 1).getTime() - 1);
}

function isoDate(d: Date): string {
  const p = bkkParts(d);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function dayLabel(d: Date): string {
  const p = bkkParts(d);
  return `${p.day} ${MONTHS_EN[p.month]}`;
}

function monthLabel(d: Date): string {
  const p = bkkParts(d);
  return `${MONTHS_EN[p.month]} ${p.year}`;
}

function monthKey(d: Date): string {
  const p = bkkParts(d);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}`;
}

/** Walk every Bangkok calendar day inclusive between from and to. */
function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  let cursor = startOfDay(from).getTime();
  const limit = startOfDay(to).getTime();
  while (cursor <= limit) {
    out.push(new Date(cursor));
    cursor += 86_400_000; // +24h → next Bangkok midnight (UTC+7, no DST)
  }
  return out;
}

/** Walk every Bangkok month inclusive between from and to. */
function eachMonth(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const start = bkkParts(from);
  const end   = bkkParts(to);
  let y = start.year;
  let m = start.month;
  while (y < end.year || (y === end.year && m <= end.month)) {
    out.push(bkkInstant(y, m, 1));
    m += 1;
    if (m > 11) { m = 0; y += 1; }
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
  // Custom takes priority if both bounds are present and valid. The
  // from/to arrive from <input type=date> as Bangkok calendar dates.
  if (preset === "custom" || (from && to)) {
    const f = from ? parseBkkDate(from) : startOfDay(new Date());
    const t = to   ? parseBkkDate(to)   : startOfDay(new Date());
    if (f && t) {
      return {
        preset: "custom",
        range: { from: startOfDay(f), to: endOfDay(t) },
      };
    }
  }

  const now   = new Date();
  const today = startOfDay(now);  // UTC instant of Bangkok-midnight today
  const tp    = bkkParts(now);    // Bangkok Y/M/D of "now"
  switch (preset) {
    case "today":
      return { preset: "today", range: { from: today, to: endOfDay(now) } };
    case "yesterday": {
      const y = new Date(today.getTime() - 86_400_000);
      return { preset: "yesterday", range: { from: y, to: endOfDay(y) } };
    }
    case "7d": {
      const start = new Date(today.getTime() - 6 * 86_400_000);
      return { preset: "7d", range: { from: start, to: endOfDay(now) } };
    }
    case "30d": {
      const start = new Date(today.getTime() - 29 * 86_400_000);
      return { preset: "30d", range: { from: start, to: endOfDay(now) } };
    }
    case "this-month": {
      const start = bkkInstant(tp.year, tp.month, 1);
      return { preset: "this-month", range: { from: start, to: endOfDay(now) } };
    }
    case "last-month": {
      const start = bkkInstant(tp.year, tp.month - 1, 1);
      const end   = new Date(bkkInstant(tp.year, tp.month, 1).getTime() - 1); // last ms of prev month
      return { preset: "last-month", range: { from: start, to: end } };
    }
    case "all":
    default: {
      // Lifetime view: walk all the way back to the earliest order if
      // we have one, otherwise fall back to "today only" so an empty
      // shop doesn't render a weird year-long axis with no data.
      const from = earliestOrder ? startOfDay(earliestOrder) : today;
      return { preset: "all", range: { from, to: endOfDay(now) } };
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
  const cardFeeRate   = settings.cardFeePercent;
  const paypalFeeRate = settings.paypalFeePercent;

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
  const methodMap = new Map<MethodLabel, { orders: number; revenue: number }>([
    ["Card",      { orders: 0, revenue: 0 }],
    ["PromptPay", { orders: 0, revenue: 0 }],
    ["PayPal",    { orders: 0, revenue: 0 }],
  ]);
  const uniqueUsers = new Set<string>();

  let paidOrders     = 0;
  let grossRevenue   = 0;
  let refundedOrders = 0;
  let refundedAmount = 0;
  let cardFeeCollected   = 0;
  let cardGrossRevenue   = 0;
  let paypalFeeCollected = 0;
  let paypalGrossRevenue = 0;

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
      const method: MethodLabel =
        order.paymentMethod === "CARD"   ? "Card" :
        order.paymentMethod === "PAYPAL" ? "PayPal" :
        "PromptPay";
      const m = methodMap.get(method)!;
      m.orders  += 1;
      m.revenue += amount;

      // Per-gateway surcharge — back out using the CURRENT rate.
      //   amount = base × (1 + rate/100)  →  fee = amount × rate / (100 + rate)
      // Gross totals accumulate for every order of that method so the
      // pre-fee revenue is correct even when the rate is 0%.
      if (method === "Card") {
        cardGrossRevenue += amount;
        if (cardFeeRate > 0) cardFeeCollected += amount * cardFeeRate / (100 + cardFeeRate);
      } else if (method === "PayPal") {
        paypalGrossRevenue += amount;
        if (paypalFeeRate > 0) paypalFeeCollected += amount * paypalFeeRate / (100 + paypalFeeRate);
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
    paypalFee: {
      ratePercent: paypalFeeRate,
      collected:   paypalFeeCollected,
      netRevenue:  paypalGrossRevenue - paypalFeeCollected,
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
