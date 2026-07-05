import type { Metadata } from "next";
import { TrendingUp, FileDown } from "lucide-react";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { Donut } from "@/components/admin/charts/Donut";
import {
  getMonthlyFinance,
  getSixMonthTrend,
  parseMonthKey,
  fmtTHB,
} from "@/lib/finance";
import { MonthPicker } from "./MonthPicker";
import { TrendChart } from "./TrendChart";
import { GameCard } from "./GameCard";

export const metadata: Metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

// Stable colour palette for partner donut slices. The shared pool
// always gets the neutral grey at the end of the array.
const PARTNER_COLOURS = [
  "hsl(330 75% 50%)",
  "hsl(265 60% 55%)",
  "hsl(200 70% 50%)",
  "hsl(35 85% 55%)",
  "hsl(150 55% 45%)",
  "hsl(15 75% 55%)",
  "hsl(280 50% 60%)",
];
const POOL_COLOUR = "hsl(0 0% 65%)";

type SearchParams = { month?: string };

export default async function FinancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();

  const { year, month } = parseMonthKey(searchParams.month);
  const selectedKey = `${year}-${String(month).padStart(2, "0")}`;

  const [data, trend] = await Promise.all([
    getMonthlyFinance(year, month),
    getSixMonthTrend(year, month),
  ]);

  const exportHref = (kind: "csv" | "pdf") =>
    `/admin/finance/export/${kind}?month=${selectedKey}`;

  // Donut segments: each partner + shared pool (only if > 0)
  const donutSegments = [
    ...data.perPartner.map((p, i) => ({
      label: p.name,
      value: p.payout,
      color: PARTNER_COLOURS[i % PARTNER_COLOURS.length]!,
    })),
    ...(data.totals.sharedPool > 0
      ? [{ label: "เงินกลาง", value: data.totals.sharedPool, color: POOL_COLOUR }]
      : []),
  ];

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="Operations"
        title="Finance"
        subtitle={`สรุปยอดและการแบ่ง Partner ของเดือน ${selectedKey} — ตัดยอดเดือนปัจจุบัน, แสดง trend 6 เดือนล่าสุด`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MonthPicker selectedMonth={selectedKey} basePath="/admin/finance" />
            <a
              href={exportHref("csv")}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-light px-3 py-1.5 text-[12px] font-semibold text-fg-light-soft hover:bg-paper-2 hover:text-fg-light"
            >
              <FileDown size={12} strokeWidth={2.25} />
              CSV
            </a>
            <a
              href={exportHref("pdf")}
              className="inline-flex items-center gap-1.5 rounded-full bg-pink-500 px-3 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_2px_0_var(--pink-600)] hover:bg-pink-600"
            >
              <FileDown size={12} strokeWidth={2.5} />
              PDF
            </a>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total gross"     value={fmtTHB(data.totals.gross)} />
        <KpiCard label="Partner payout"  value={fmtTHB(data.totals.partnerPayout)} tone="pink" />
        <KpiCard label="เงินกลาง"          value={fmtTHB(data.totals.sharedPool)}    tone="gray" />
        <KpiCard label="Orders"          value={data.totals.orderCount.toLocaleString()} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="panel rounded-xl p-4 sm:p-5 lg:col-span-2">
          <h2 className="mb-3 text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
            Trend (6 เดือนล่าสุด)
          </h2>
          <TrendChart points={trend} />
        </div>
        <div className="panel rounded-xl p-4 sm:p-5">
          <h2 className="mb-3 text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
            Distribution
          </h2>
          {donutSegments.length === 0 ? (
            <p className="text-[12px] text-fg-light-soft">ไม่มีข้อมูลในเดือนนี้</p>
          ) : (
            <Donut
              segments={donutSegments}
              centerLabel={fmtTHB(data.totals.gross)}
              centerSub="GROSS"
              size={156}
            />
          )}
        </div>
      </div>

      {/* Per game */}
      <div className="space-y-3">
        <h2 className="text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
          Per Game
        </h2>
        {data.perGame.length === 0 ? (
          <EmptyState
            icon={<TrendingUp size={20} />}
            title="ยังไม่มีรายได้เดือนนี้"
            description="ไม่พบ PAID order ในช่วงนี้ — ลองเลือกเดือนอื่น"
          />
        ) : (
          <div className="space-y-3">
            {data.perGame.map((g) => (
              <GameCard key={g.productId} game={g} totalMonthGross={data.totals.gross} />
            ))}
          </div>
        )}
      </div>

      {/* Per partner aggregate */}
      {data.perPartner.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
            Per Partner (Aggregate)
          </h2>
          <div className="panel overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
                <thead className="border-b border-line-light bg-paper-2/40 text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Partner</th>
                    <th className="px-4 py-2.5 font-semibold">Contact</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Games</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Orders</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Avg / order</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-light text-fg-light">
                  {data.perPartner.map((p) => (
                    <tr key={p.partnerId} className="hover:bg-paper-2/30">
                      <td className="px-4 py-3 font-semibold">{p.name}</td>
                      <td className="px-4 py-3 text-fg-light-soft">{p.contact ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.gameCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.orderCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-fg-light-soft">{fmtTHB(p.avgPerOrder)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-pink-500">{fmtTHB(p.payout)}</td>
                    </tr>
                  ))}
                  {data.totals.sharedPool > 0 && (
                    <tr className="bg-paper-2/40">
                      <td className="px-4 py-3 font-semibold text-fg-light-soft">— เงินกลาง —</td>
                      <td className="px-4 py-3 text-fg-light-mute">—</td>
                      <td className="px-4 py-3 text-right text-fg-light-mute">—</td>
                      <td className="px-4 py-3 text-right text-fg-light-mute">—</td>
                      <td className="px-4 py-3 text-right text-fg-light-mute">—</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-fg-light">
                        {fmtTHB(data.totals.sharedPool)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
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
  tone?: "pink" | "gray";
}) {
  return (
    <div className="panel rounded-xl p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-light-mute">{label}</p>
      <p
        className={
          tone === "pink"
            ? "mt-1 font-display text-[22px] text-pink-500"
            : tone === "gray"
              ? "mt-1 font-display text-[22px] text-fg-light-soft"
              : "mt-1 font-display text-[22px] text-fg-light"
        }
      >
        {value}
      </p>
    </div>
  );
}
