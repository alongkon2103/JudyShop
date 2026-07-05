/**
 * Partner-scoped revenue view for the /partner portal.
 *
 * Mirrors the money math in `finance.ts` but scopes every query to a
 * single `partnerId` at the DB level: a partner can only ever pull the
 * orders of products they hold a share in. Totals and the 6-month trend
 * are the partner's OWN slice only. The per-game breakdown, however,
 * lists the full recipient split (every partner + the shared pool
 * "เงินกลาง") so the partner can see how the remaining share is divided —
 * a deliberate product decision, still scoped to the partner's own games.
 *
 * Month boundaries use server-local time to stay consistent with the
 * admin Finance page (`src/lib/finance.ts`) so a partner and the admin
 * read identical monthly figures. Both carry the same known caveat: on a
 * UTC host the month edge is off by the +7h Bangkok offset. The daily
 * dashboard buckets in Bangkok time (see /partner/page.tsx) to match the
 * admin dashboard, which was already corrected.
 */
import { db } from "./db";

export type PartnerRecipientLine = {
  /** null = the shared pool ("เงินกลาง"). */
  partnerId: string | null;
  name: string;
  sharePercent: number;
  /** gross × sharePercent / 100 for this game this month. */
  payout: number;
  /** True for the viewing partner's own row (highlighted in the UI). */
  isYou: boolean;
};

export type PartnerGameLine = {
  productId: string;
  slug: string;
  name: string;
  sharePercent: number;
  /** Gross ฿ of this game's PAID orders this month (100%, all owners). */
  gross: number;
  orderCount: number;
  /** gross × sharePercent / 100 — the partner's cut. */
  payout: number;
  /** Full split for this game: every partner + the shared pool, so the
   *  partner sees who gets the rest — not just their own cut. */
  recipients: PartnerRecipientLine[];
};

export type PartnerMonthly = {
  monthKey: string; // "2026-06"
  monthStart: Date;
  monthEnd: Date; // exclusive
  totalPayout: number;
  totalOrders: number;
  /** Gross of every order across the partner's games (100%). */
  totalGross: number;
  perGame: PartnerGameLine[];
};

export type PartnerTrendPoint = {
  monthKey: string;
  label: string; // "Jun 2026"
  /** Gross of the partner's games that month (100%, all owners). */
  gross: number;
  /** The partner's slice of that gross. */
  payout: number;
};

const MONTH_LABELS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}
function startOfNextMonth(year: number, month: number): Date {
  return new Date(year, month, 1, 0, 0, 0, 0);
}

export function partnerMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Aggregate one calendar month of a single partner's earnings. */
export async function getPartnerMonthlyFinance(
  partnerId: string,
  year: number,
  month: number,
): Promise<PartnerMonthly> {
  const monthStart = startOfMonth(year, month);
  const monthEnd = startOfNextMonth(year, month);

  const orders = await db.order.findMany({
    where: {
      status: "PAID",
      createdAt: { gte: monthStart, lt: monthEnd },
      // Scope: only orders of products this partner holds a share in.
      product: { partners: { some: { partnerId } } },
    },
    select: {
      id: true,
      amount: true,
      product: {
        select: {
          id: true,
          slug: true,
          nameEn: true,
          // Every recipient on the game (name + share) — so the card can
          // render the full split, not just the viewer's own row. Still
          // only reachable for the partner's own games (scoped above).
          partners: {
            select: {
              partnerId: true,
              sharePercent: true,
              partner: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  type Roster = { partnerId: string; sharePercent: number; name: string };
  type Acc = { line: PartnerGameLine; roster: Roster[] };
  const perGameMap = new Map<string, Acc>();
  let totalPayout = 0;
  let totalGross = 0;

  for (const order of orders) {
    const amount = Number(order.amount);
    const product = order.product;
    // The viewer's own share row within this game's roster.
    const mine = product.partners.find((pp) => pp.partnerId === partnerId);
    const pct = Number(mine?.sharePercent ?? 0);
    const slice = amount * (pct / 100);
    totalGross += amount;
    totalPayout += slice;

    let g = perGameMap.get(product.id);
    if (!g) {
      g = {
        line: {
          productId: product.id,
          slug: product.slug,
          name: product.nameEn,
          sharePercent: pct,
          gross: 0,
          orderCount: 0,
          payout: 0,
          recipients: [],
        },
        roster: product.partners.map((pp) => ({
          partnerId: pp.partnerId,
          sharePercent: Number(pp.sharePercent),
          name: pp.partner.name,
        })),
      };
      perGameMap.set(product.id, g);
    }
    g.line.gross += amount;
    g.line.orderCount += 1;
    g.line.payout += slice;
  }

  // Resolve each game's recipient split from its final monthly gross.
  const perGame = Array.from(perGameMap.values())
    .map(({ line, roster }) => {
      const recipients: PartnerRecipientLine[] = roster.map((r) => ({
        partnerId: r.partnerId,
        name: r.name,
        sharePercent: r.sharePercent,
        payout: line.gross * (r.sharePercent / 100),
        isYou: r.partnerId === partnerId,
      }));

      // Anything not owned by a partner is the house's shared pool.
      const shareSum = roster.reduce((a, r) => a + r.sharePercent, 0);
      const poolPct = 100 - shareSum;
      if (poolPct > 1e-9) {
        recipients.push({
          partnerId: null,
          name: "เงินกลาง",
          sharePercent: poolPct,
          payout: line.gross * (poolPct / 100),
          isYou: false,
        });
      }
      recipients.sort((a, b) => b.payout - a.payout);

      return { ...line, recipients };
    })
    .sort((a, b) => b.payout - a.payout);

  return {
    monthKey: partnerMonthKey(year, month),
    monthStart,
    monthEnd,
    totalPayout,
    totalOrders: orders.length,
    totalGross,
    perGame,
  };
}

/** 6-month payout trend ending at (year, month), oldest first. */
export async function getPartnerSixMonthTrend(
  partnerId: string,
  year: number,
  month: number,
): Promise<PartnerTrendPoint[]> {
  const points: PartnerTrendPoint[] = [];
  for (let offset = 5; offset >= 0; offset--) {
    let y = year;
    let m = month - offset;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }

    const start = startOfMonth(y, m);
    const end = startOfNextMonth(y, m);
    const orders = await db.order.findMany({
      where: {
        status: "PAID",
        createdAt: { gte: start, lt: end },
        product: { partners: { some: { partnerId } } },
      },
      select: {
        amount: true,
        product: {
          select: {
            partners: { where: { partnerId }, select: { sharePercent: true } },
          },
        },
      },
    });

    let gross = 0;
    let payout = 0;
    for (const o of orders) {
      const amount = Number(o.amount);
      const pct = Number(o.product.partners[0]?.sharePercent ?? 0);
      gross += amount;
      payout += amount * (pct / 100);
    }

    points.push({
      monthKey: partnerMonthKey(y, m),
      label: `${MONTH_LABELS_EN[m - 1]} ${y}`,
      gross,
      payout,
    });
  }
  return points;
}
