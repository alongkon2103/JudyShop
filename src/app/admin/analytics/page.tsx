import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { Donut } from "@/components/admin/charts/Donut";
import {
  getShopAnalytics,
  resolveRange,
  getEarliestOrderDate,
  fmtTHB,
  isoDate,
} from "@/lib/analytics";
import { DateRangePicker } from "./DateRangePicker";
import { DailyTimelineChart } from "./DailyTimelineChart";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

type SearchParams = {
  preset?: string;
  from?: string;
  to?: string;
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();

  // The "all" preset needs the date of the oldest order to anchor
  // its lower bound — fetch that once and feed it into the resolver.
  const earliestOrder = await getEarliestOrderDate();
  const { preset, range } = resolveRange(
    searchParams.preset,
    searchParams.from,
    searchParams.to,
    earliestOrder,
  );
  const data = await getShopAnalytics(range);

  const fromIso = isoDate(range.from);
  const toIso   = isoDate(range.to);
  const bucketCount = data.timeline.length;
  const granularityLabel = data.granularity === "daily" ? "วัน" : "เดือน";

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="Overview"
        title="Analytics"
        subtitle={`สรุปออเดอร์และยอดขายแบบละเอียด — เลือกช่วงวันได้ตามต้องการ`}
        actions={
          <DateRangePicker
            selectedPreset={preset}
            from={fromIso}
            to={toIso}
          />
        }
      />

      {/* Period banner — confirms exactly what window the numbers cover */}
      <div className="panel flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-[12px] text-fg-light-soft">
        <span>
          ช่วงที่เลือก: <strong className="text-fg-light">{fromIso}</strong> →{" "}
          <strong className="text-fg-light">{toIso}</strong>{" "}
          <span className="text-fg-light-mute">
            ({bucketCount} {granularityLabel})
          </span>
        </span>
        <span className="text-fg-light-mute">
          ตัวเลขรวมเฉพาะออเดอร์ที่ PAID — REFUNDED แสดงแยก
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Paid orders"    value={data.totals.paidOrders.toLocaleString()} />
        <Kpi label="Gross revenue"  value={fmtTHB(data.totals.grossRevenue)}    tone="pink" />
        <Kpi label="Avg / order"    value={fmtTHB(data.totals.avgPerOrder)} />
        <Kpi label="Unique buyers"  value={data.totals.uniqueUsernames.toLocaleString()} />
        <Kpi
          label={`Refunded (${data.totals.refundedOrders})`}
          value={fmtTHB(data.totals.refundedAmount)}
          tone="gray"
        />
      </div>

      {/* Timeline chart */}
      <div className="panel rounded-xl p-4 sm:p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
            Timeline (ราย{granularityLabel})
          </h2>
          <p className="text-[11px] text-fg-light-mute">
            แท่ง = ยอดขาย · ชี้เมาส์ที่แท่งเพื่อดูจำนวนออเดอร์
          </p>
        </div>
        <DailyTimelineChart points={data.timeline} />
      </div>

      {/* Per-game + per-method row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="panel rounded-xl p-4 sm:p-5 lg:col-span-2">
          <h2 className="mb-3 text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
            Per Game (รายเกม)
          </h2>
          {data.byGame.length === 0 ? (
            <EmptyState
              icon={<BarChart3 size={20} />}
              title="ไม่มียอดขายในช่วงนี้"
              description="ลองเปลี่ยนช่วงวัน — หรือเช็คว่ามีสินค้าที่กำลังขายอยู่"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[12.5px]">
                <thead className="border-b border-line-light bg-paper-2/40 text-[10.5px] uppercase tracking-[0.06em] text-fg-light-mute">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Game</th>
                    <th className="px-3 py-2 text-right font-semibold">Orders</th>
                    <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                    <th className="px-3 py-2 text-right font-semibold">Avg / order</th>
                    <th className="px-3 py-2 text-right font-semibold">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-light text-fg-light">
                  {data.byGame.map((g) => (
                    <tr key={g.productId} className="hover:bg-paper-2/30">
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-fg-light">{g.name}</p>
                        <p className="text-[11px] text-fg-light-mute">/{g.slug}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{g.orders.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-pink-500">{fmtTHB(g.revenue)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-fg-light-soft">{fmtTHB(g.avgPerOrder)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <ShareBar pct={g.pctOfTotal} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel space-y-4 rounded-xl p-4 sm:p-5">
          <h2 className="text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
            Payment Method
          </h2>
          {data.byMethod.length === 0 ? (
            <p className="text-[12px] text-fg-light-soft">ไม่มีข้อมูล</p>
          ) : (
            <>
              <Donut
                segments={data.byMethod.map((m) => ({
                  label: m.method,
                  value: m.revenue,
                  color:
                    m.method === "Card"      ? "hsl(265 60% 55%)" :  // violet
                    m.method === "PayPal"    ? "hsl(42 95% 55%)" :   // gold (PayPal brand)
                    /* PromptPay */            "hsl(330 75% 50%)",   // pink
                }))}
                centerLabel={data.totals.paidOrders.toLocaleString()}
                centerSub="ORDERS"
                size={156}
              />
              <table className="w-full text-[11px]">
                <thead className="text-fg-light-mute">
                  <tr>
                    <th className="py-1 text-left font-semibold">Method</th>
                    <th className="py-1 text-right font-semibold">Orders</th>
                    <th className="py-1 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody className="text-fg-light">
                  {data.byMethod.map((m) => (
                    <tr key={m.method} className="border-t border-line-light">
                      <td className="py-1.5">{m.method}</td>
                      <td className="py-1.5 text-right tabular-nums">{m.orders}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtTHB(m.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Per-gateway surcharge breakdowns — both cards render whether
              or not the gateway had orders, so admin always sees the
              current rate even on slow days. */}
          <FeeBreakdownCard
            label="ค่าธรรมเนียมบัตร"
            sourceLabel="บัตร"
            stat={data.cardFee}
          />
          <FeeBreakdownCard
            label="ค่าธรรมเนียม PayPal"
            sourceLabel="PayPal"
            stat={data.paypalFee}
          />
        </div>
      </div>
    </section>
  );
}

function FeeBreakdownCard({
  label,
  sourceLabel,
  stat,
}: {
  label: string;
  sourceLabel: string;
  stat: { ratePercent: number; collected: number; netRevenue: number };
}) {
  return (
    <div className=" bg-pink-500/5 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-pink-400">
        {label}{" "}
        <span className="ml-1 rounded-full bg-pink-500/15 px-2 py-0.5 tabular-nums">
          {stat.ratePercent.toFixed(2)}%
        </span>
      </p>
      <p className="mt-1.5 font-display text-[24px] text-pink-500">
        {fmtTHB(stat.collected)}
      </p>
      <p className="mt-1 text-[10.5px] text-fg-light-soft">
        เก็บได้จากออเดอร์ที่จ่ายผ่าน{sourceLabel}ในช่วงนี้
        {stat.collected > 0 && (
          <>
            {" · "}
            ฐานก่อนคิดค่าธรรมเนียม{" "}
            <strong className="text-fg-light">{fmtTHB(stat.netRevenue)}</strong>
          </>
        )}
      </p>
      {stat.ratePercent === 0 && (
        <p className="mt-1.5 text-[10.5px] text-fg-light-mute">
          ยังไม่ได้ตั้งค่าธรรมเนียม{sourceLabel} — ตั้งได้ที่{" "}
          <a href="/admin/settings" className="font-semibold text-pink-400 hover:underline">
            Settings
          </a>
        </p>
      )}
    </div>
  );
}

function Kpi({
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
            ? "mt-1 font-display text-[20px] text-pink-500"
            : tone === "gray"
              ? "mt-1 font-display text-[20px] text-fg-light-soft"
              : "mt-1 font-display text-[20px] text-fg-light"
        }
      >
        {value}
      </p>
    </div>
  );
}

function ShareBar({ pct }: { pct: number }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="font-semibold tabular-nums text-fg-light-soft">
        {pct.toFixed(1)}%
      </span>
      <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-paper-2">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-pink-500"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </span>
    </div>
  );
}
