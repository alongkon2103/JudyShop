/**
 * Admin dashboard metrics.
 * Server-only. All queries hit Postgres directly via Prisma.
 */
import { db } from "@/lib/db";

export type Kpi = {
  /** Numeric value for the current window. */
  value: number;
  /** Numeric value for the previous window (same length, immediately before). */
  previous: number;
  /** Percent delta vs previous window. NaN when previous = 0. */
  deltaPct: number;
};

export type DashboardMetrics = {
  windowDays: number;
  revenue:      Kpi;
  paidOrders:   Kpi;
  newCustomers: Kpi;
  activeWhitelist: { value: number; lifetime: number; duration: number; expired: number };
  revenueSeries: { date: string; revenue: number; orders: number }[];
  topProducts:   { id: string; name: string; revenue: number; orders: number }[];
  orderStatus:   { paid: number; pending: number; failed: number; refunded: number };
  recentOrders:  RecentOrder[];
};

export type RecentOrder = {
  id: string;
  username: string;
  amount: number;
  status: "PAID" | "PENDING" | "FAILED" | "REFUNDED";
  paymentMethod: "PROMPTPAY" | "CARD" | "PAYPAL";
  productName: string;
  createdAt: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function dateKey(d: Date): string {
  // YYYY-MM-DD in UTC — chart series shares one tz with the server
  return d.toISOString().slice(0, 10);
}

export async function getDashboardMetrics(windowDays = 30): Promise<DashboardMetrics> {
  const now = new Date();

  // Snap to start of today (UTC) so the last bucket *is* today — otherwise
  // sliding the window back by N days from `now` makes today fall outside
  // the bucket range and the chart silently drops today's orders.
  const startOfToday = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
  ));
  const winStart  = new Date(startOfToday.getTime() - (windowDays - 1) * DAY_MS);
  const prevStart = new Date(winStart.getTime() - windowDays * DAY_MS);

  // ── 1. Revenue + paid-order count (current vs previous window) ─────
  const [curPaid, prevPaid] = await Promise.all([
    db.order.findMany({
      where: { status: "PAID", createdAt: { gte: winStart } },
      select: { amount: true, username: true, createdAt: true },
    }),
    db.order.findMany({
      where: { status: "PAID", createdAt: { gte: prevStart, lt: winStart } },
      select: { amount: true, username: true },
    }),
  ]);

  const curRevenue  = curPaid.reduce((sum, o) => sum + Number(o.amount), 0);
  const prevRevenue = prevPaid.reduce((sum, o) => sum + Number(o.amount), 0);

  const revenue: Kpi = {
    value: curRevenue,
    previous: prevRevenue,
    deltaPct: pctDelta(curRevenue, prevRevenue),
  };

  const paidOrders: Kpi = {
    value: curPaid.length,
    previous: prevPaid.length,
    deltaPct: pctDelta(curPaid.length, prevPaid.length),
  };

  // ── 2. New customers — usernames whose FIRST paid order falls in the window
  const curUsernames  = new Set(curPaid.map((o) => o.username));
  const prevUsernames = new Set(prevPaid.map((o) => o.username));

  let curNew = 0;
  let prevNew = 0;
  if (curUsernames.size > 0 || prevUsernames.size > 0) {
    // For each candidate username, find earliest PAID order; if it falls in window → new.
    const allUsernames = [...new Set([...curUsernames, ...prevUsernames])];
    const firsts = await db.order.findMany({
      where: { status: "PAID", username: { in: allUsernames } },
      select: { username: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const firstByUser = new Map<string, Date>();
    for (const o of firsts) {
      if (!firstByUser.has(o.username)) firstByUser.set(o.username, o.createdAt);
    }
    for (const [u, d] of firstByUser) {
      if (d >= winStart) curNew++;
      else if (d >= prevStart && d < winStart) prevNew++;
      // unused branch on stricter clients
      void u;
    }
  }

  const newCustomers: Kpi = {
    value: curNew,
    previous: prevNew,
    deltaPct: pctDelta(curNew, prevNew),
  };

  // ── 3. Active whitelist breakdown ──────────────────────────────────
  const [lifetimeCount, durationActive, durationExpired] = await Promise.all([
    db.whitelist.count({ where: { isLifetime: true } }),
    db.whitelist.count({ where: { isLifetime: false, expireDate: { gt: now } } }),
    db.whitelist.count({ where: { isLifetime: false, expireDate: { lte: now } } }),
  ]);
  const activeWhitelist = {
    value: lifetimeCount + durationActive,
    lifetime: lifetimeCount,
    duration: durationActive,
    expired: durationExpired,
  };

  // ── 4. Daily revenue series (windowDays buckets) ───────────────────
  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(winStart.getTime() + i * DAY_MS);
    buckets.set(dateKey(d), { revenue: 0, orders: 0 });
  }
  for (const o of curPaid) {
    const key = dateKey(o.createdAt);
    const slot = buckets.get(key);
    if (slot) {
      slot.revenue += Number(o.amount);
      slot.orders  += 1;
    }
  }
  const revenueSeries = [...buckets.entries()].map(([date, v]) => ({
    date,
    revenue: v.revenue,
    orders: v.orders,
  }));

  // ── 5. Top products (current window, PAID) ─────────────────────────
  const grouped = await db.order.groupBy({
    by: ["productId"],
    where: { status: "PAID", createdAt: { gte: winStart } },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 5,
  });
  const productIds = grouped.map((g) => g.productId);
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, nameEn: true, nameTh: true },
      })
    : [];
  const nameById = new Map(products.map((p) => [p.id, p.nameEn || p.nameTh]));
  const topProducts = grouped.map((g) => ({
    id: g.productId,
    name: nameById.get(g.productId) ?? "—",
    revenue: Number(g._sum.amount ?? 0),
    orders: g._count._all,
  }));

  // ── 6. Order status mix (current window, ALL statuses) ─────────────
  const statusGrouped = await db.order.groupBy({
    by: ["status"],
    where: { createdAt: { gte: winStart } },
    _count: { _all: true },
  });
  const orderStatus = { paid: 0, pending: 0, failed: 0, refunded: 0 };
  for (const s of statusGrouped) {
    if (s.status === "PAID")      orderStatus.paid     = s._count._all;
    if (s.status === "PENDING")   orderStatus.pending  = s._count._all;
    if (s.status === "FAILED")    orderStatus.failed   = s._count._all;
    if (s.status === "REFUNDED")  orderStatus.refunded = s._count._all;
  }

  // ── 7. Recent orders ───────────────────────────────────────────────
  const recent = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { product: { select: { nameEn: true, nameTh: true } } },
  });
  const recentOrders: RecentOrder[] = recent.map((o) => ({
    id: o.id,
    username: o.username,
    amount: Number(o.amount),
    status: o.status,
    paymentMethod: o.paymentMethod,
    productName: o.product?.nameEn || o.product?.nameTh || "—",
    createdAt: o.createdAt,
  }));

  return {
    windowDays,
    revenue,
    paidOrders,
    newCustomers,
    activeWhitelist,
    revenueSeries,
    topProducts,
    orderStatus,
    recentOrders,
  };
}
