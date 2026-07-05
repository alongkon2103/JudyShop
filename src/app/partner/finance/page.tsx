import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import { requirePartner } from "@/lib/admin-session";
import { parseMonthKey, fmtTHB } from "@/lib/finance";
import {
  getPartnerMonthlyFinance,
  getPartnerSixMonthTrend,
  type PartnerGameLine,
} from "@/lib/partner-finance";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
// Reused, now that MonthPicker takes a basePath and TrendChart is pure SVG.
import { MonthPicker } from "@/app/admin/finance/MonthPicker";
import { TrendChart } from "@/app/admin/finance/TrendChart";

export const metadata: Metadata = { title: "Partner · รายได้" };
export const dynamic = "force-dynamic";

type SearchParams = { month?: string };

export default async function PartnerFinancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { partnerId } = await requirePartner();

  // Same month parsing as the admin Finance page so a partner and the
  // admin read identical monthly figures for the same game.
  const { year, month } = parseMonthKey(searchParams.month);
  const selectedKey = `${year}-${String(month).padStart(2, "0")}`;

  const [data, trend] = await Promise.all([
    getPartnerMonthlyFinance(partnerId, year, month),
    getPartnerSixMonthTrend(partnerId, year, month),
  ]);

  // TrendChart draws two bars/month: here Gross = the partner's games'
  // gross, "Partner Payout" = the partner's own slice. No shared pool.
  const trendPoints = trend.map((t) => ({
    monthKey: t.monthKey,
    label: t.label,
    gross: t.gross,
    partnerPayout: t.payout,
    sharedPool: 0,
  }));

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="Partner"
        title="รายได้ของคุณ"
        subtitle={`สรุปส่วนแบ่งเฉพาะเกมของคุณ — เดือน ${selectedKey} · แสดง trend 6 เดือนล่าสุด`}
        actions={<MonthPicker selectedMonth={selectedKey} basePath="/partner/finance" />}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="ส่วนแบ่งของคุณ" value={fmtTHB(data.totalPayout)} tone="pink" />
        <KpiCard label="ยอดขายเกมคุณ (100%)" value={fmtTHB(data.totalGross)} />
        <KpiCard label="ออเดอร์" value={data.totalOrders.toLocaleString()} />
        <KpiCard label="เกม" value={data.perGame.length.toLocaleString()} />
      </div>

      {/* Trend */}
      <div className="panel rounded-xl p-4 sm:p-5">
        <h2 className="mb-3 text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
          Trend (6 เดือนล่าสุด)
        </h2>
        <TrendChart points={trendPoints} />
      </div>

      {/* Per game — scoped: only this partner's own share is shown, never
          other partners' slices or the shared pool. */}
      <div className="space-y-3">
        <h2 className="text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
          รายเกม
        </h2>
        {data.perGame.length === 0 ? (
          <EmptyState
            icon={<TrendingUp size={20} />}
            title="ยังไม่มีรายได้เดือนนี้"
            description="ไม่พบออเดอร์ในเกมของคุณช่วงนี้ — ลองเลือกเดือนอื่น"
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.perGame.map((g) => (
              <GameCard key={g.productId} game={g} totalGross={data.totalGross} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pink";
}) {
  return (
    <div className="panel rounded-xl p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-light-mute">
        {label}
      </p>
      <p
        className={
          "mt-1 font-display text-[22px] " +
          (tone === "pink" ? "text-pink-500" : "text-fg-light")
        }
      >
        {value}
      </p>
    </div>
  );
}

/**
 * One card per game, styled like the admin Finance GameCard. The recipient
 * table lists the FULL split — every partner + the shared pool ("เงินกลาง")
 * — with the viewing partner's own row highlighted, so they can see how the
 * remaining share is divided. Contacts are omitted (only names / shares /
 * payouts), and the data is always scoped to the partner's own games.
 */
function GameCard({
  game,
  totalGross,
}: {
  game: PartnerGameLine;
  /** Partner's total gross this month — for the "ของเดือนคุณ" %. */
  totalGross: number;
}) {
  const avgPerOrder = game.orderCount > 0 ? game.gross / game.orderCount : 0;
  const pctOfMonth = totalGross > 0 ? (game.gross / totalGross) * 100 : 0;

  return (
    <div className="panel space-y-3 rounded-xl p-4 sm:p-5">
      {/* Header — game name + this game's gross (100%) */}
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-light pb-3">
        <h3 className="font-display text-[20px] tracking-wide text-fg-light">{game.name}</h3>
        <span className="font-display text-[22px] text-pink-500">{fmtTHB(game.gross)}</span>
      </header>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Stat label="ออเดอร์" value={game.orderCount.toLocaleString()} />
        <Stat label="เฉลี่ย/ออเดอร์" value={fmtTHB(avgPerOrder)} />
        <Stat label="ของเดือนคุณ" value={`${pctOfMonth.toFixed(1)}%`} />
      </div>

      {/* Full split — your own row highlighted, the rest shown so you can
          see who gets the remaining share (+ the shared pool). */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead className="border-b border-line-light text-[10px] uppercase tracking-[0.06em] text-fg-light-mute">
            <tr>
              <th className="px-2 py-1.5 font-semibold">ผู้รับส่วนแบ่ง</th>
              <th className="px-2 py-1.5 text-right font-semibold">ส่วนแบ่ง</th>
              <th className="px-2 py-1.5 text-right font-semibold">รายได้</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-light">
            {game.recipients.map((r, i) => {
              const isPool = r.partnerId === null;
              return (
                <tr
                  key={i}
                  className={r.isYou ? "bg-pink-500/5" : isPool ? "bg-paper-2/40" : ""}
                >
                  <td className="px-2 py-1.5">
                    <span
                      className={
                        r.isYou
                          ? "font-semibold text-pink-500"
                          : isPool
                            ? "font-semibold text-fg-light-soft"
                            : "font-semibold text-fg-light"
                      }
                    >
                      {isPool ? "— เงินกลาง —" : r.name}
                    </span>
                    {r.isYou && (
                      <span className="ml-1 text-[10px] font-normal text-fg-light-mute">(คุณ)</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-fg-light-soft">
                    {r.sharePercent.toFixed(2)}%
                  </td>
                  <td
                    className={
                      "px-2 py-1.5 text-right font-semibold tabular-nums " +
                      (r.isYou ? "text-pink-500" : "text-fg-light")
                    }
                  >
                    {fmtTHB(r.payout)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line-light bg-paper-2/40 px-2 py-1.5">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-fg-light-mute">
        {label}
      </p>
      <p className="text-[13px] font-bold text-fg-light">{value}</p>
    </div>
  );
}
