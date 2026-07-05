import type { Metadata } from "next";
import { requirePartner } from "@/lib/admin-session";
import { db } from "@/lib/db";
import {
  getPartnerMonthlyFinance,
  getPartnerDailyPayoutSeries,
} from "@/lib/partner-finance";
import { formatTHB } from "@/lib/format";
import { PageHeader } from "@/components/admin/PageHeader";
import { MonthPicker } from "@/app/admin/finance/MonthPicker";
import { RevenueAreaChart } from "@/components/admin/charts/RevenueAreaChart";

export const metadata: Metadata = { title: "Partner · Dashboard" };
export const dynamic = "force-dynamic";

/** Rolling window for the daily revenue line chart (like the admin dashboard). */
const WINDOW_DAYS = 30;

const MONTHS_TH = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Current year+month in Bangkok time — matches the (already corrected)
 *  admin dashboard so a partner's "this month" edge never disagrees with
 *  what the shop sees on a UTC production host. */
function bkkNowYearMonth() {
  const s = new Date(Date.now() + BKK_OFFSET_MS);
  return { year: s.getUTCFullYear(), month: s.getUTCMonth() + 1 };
}

/** Selected month from ?month=YYYY-MM, else the current Bangkok month.
 *  Kept local (not finance.ts's parseMonthKey) so the *default* stays in
 *  Bangkok time rather than the server's local now. */
function resolveMonth(raw: string | undefined) {
  if (raw) {
    const m = /^(\d{4})-(\d{1,2})$/.exec(raw);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      if (month >= 1 && month <= 12) return { year, month };
    }
  }
  return bkkNowYearMonth();
}

type SearchParams = { month?: string };

export default async function PartnerDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { partnerId } = await requirePartner();
  const { year, month } = resolveMonth(searchParams.month);
  const selectedKey = `${year}-${String(month).padStart(2, "0")}`;

  const [monthly, series, activeWhitelist, gameCount] = await Promise.all([
    getPartnerMonthlyFinance(partnerId, year, month),
    // Rolling last-30-days daily payout — always anchored to today, so it
    // doesn't move with the month picker above (which drives the KPIs/table).
    getPartnerDailyPayoutSeries(partnerId, WINDOW_DAYS),
    db.whitelist.count({
      where: {
        product: { partners: { some: { partnerId } } },
        OR: [{ isLifetime: true }, { expireDate: { gt: new Date() } }],
      },
    }),
    db.productPartner.count({ where: { partnerId } }),
  ]);

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="Partner"
        title="ภาพรวม"
        subtitle={`ยอดของคุณ · ${MONTHS_TH[month - 1]} ${year}`}
        actions={<MonthPicker selectedMonth={selectedKey} basePath="/partner" />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="รายได้ (ส่วนแบ่งคุณ)" value={formatTHB(monthly.totalPayout)} highlight />
        <Kpi label="ออเดอร์" value={monthly.totalOrders.toLocaleString()} />
        <Kpi label="Whitelist ที่ยัง active" value={activeWhitelist.toLocaleString()} />
        <Kpi label="เกมของคุณ" value={gameCount.toLocaleString()} />
      </div>

      <div className="panel rounded-xl p-4 sm:p-5">
        <div className="mb-3">
          <h2 className="text-[14px] font-semibold text-fg-light">รายได้รายวัน</h2>
          <p className="text-[12px] text-fg-light-mute">
            ส่วนแบ่งของคุณ {WINDOW_DAYS} วันล่าสุด (เฉพาะออเดอร์ PAID)
          </p>
        </div>
        <div className="text-fg-light">
          <RevenueAreaChart data={series} />
        </div>
      </div>

      <div className="panel overflow-hidden rounded-xl">
        <div className="border-b border-line-light bg-paper-2/40 px-4 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
            เกมของคุณ · {MONTHS_TH[month - 1]} {year}
          </p>
        </div>
        {monthly.perGame.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-fg-light-mute">
            เดือนที่เลือกยังไม่มียอดขาย
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
              <thead className="border-b border-line-light bg-paper-2/40 text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">เกม</th>
                  <th className="px-4 py-2.5 text-center font-semibold">ส่วนแบ่ง</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ออเดอร์</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ส่วนแบ่งคุณ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light text-fg-light">
                {monthly.perGame.map((g) => (
                  <tr key={g.productId} className="hover:bg-paper-2/30">
                    <td className="px-4 py-3 font-semibold">{g.name}</td>
                    <td className="px-4 py-3 text-center text-fg-light-soft tabular-nums">
                      {g.sharePercent}%
                    </td>
                    <td className="px-4 py-3 text-right text-fg-light-soft tabular-nums">
                      {g.orderCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-pink-500 tabular-nums">
                      {formatTHB(g.payout)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="panel rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">{label}</p>
      <p
        className={
          "mt-1 text-[20px] font-bold tabular-nums " +
          (highlight ? "text-pink-500" : "text-fg-light")
        }
      >
        {value}
      </p>
    </div>
  );
}
