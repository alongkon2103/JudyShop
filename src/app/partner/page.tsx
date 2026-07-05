import type { Metadata } from "next";
import { requirePartner } from "@/lib/admin-session";
import { db } from "@/lib/db";
import {
  getPartnerMonthlyFinance,
  getPartnerSixMonthTrend,
  type PartnerTrendPoint,
} from "@/lib/partner-finance";
import { formatTHB } from "@/lib/format";
import { PageHeader } from "@/components/admin/PageHeader";
import { MonthPicker } from "@/app/admin/finance/MonthPicker";

export const metadata: Metadata = { title: "Partner · Dashboard" };
export const dynamic = "force-dynamic";

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

  const [monthly, trend, activeWhitelist, gameCount] = await Promise.all([
    getPartnerMonthlyFinance(partnerId, year, month),
    getPartnerSixMonthTrend(partnerId, year, month),
    db.whitelist.count({
      where: {
        product: { partners: { some: { partnerId } } },
        OR: [{ isLifetime: true }, { expireDate: { gt: new Date() } }],
      },
    }),
    db.productPartner.count({ where: { partnerId } }),
  ]);

  const maxPayout = Math.max(1, ...trend.map((t) => t.payout));

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
        <h2 className="mb-4 text-[14px] font-semibold text-fg-light">รายได้ย้อนหลัง 6 เดือน</h2>
        <SixMonthBars trend={trend} max={maxPayout} />
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

function SixMonthBars({ trend, max }: { trend: PartnerTrendPoint[]; max: number }) {
  return (
    <div className="flex h-44 items-stretch gap-2 sm:gap-4">
      {trend.map((t) => (
        <div key={t.monthKey} className="flex h-full flex-1 flex-col items-center gap-1.5">
          <span className="text-[10px] font-semibold text-fg-light-soft tabular-nums">
            {formatTHB(t.payout)}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-pink-500/70"
              style={{ height: `${Math.max(2, (t.payout / max) * 100)}%` }}
              title={formatTHB(t.payout)}
            />
          </div>
          <span className="text-[10px] text-fg-light-mute">{t.label}</span>
        </div>
      ))}
    </div>
  );
}
