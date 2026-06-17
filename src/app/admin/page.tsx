import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Coins, Package, Receipt, ScrollText, TrendingUp, Users } from "lucide-react";
import { requireAdmin } from "@/lib/admin-session";
import { getDashboardMetrics } from "@/lib/admin/metrics";
import { formatTHB } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { RevenueAreaChart } from "@/components/admin/charts/RevenueAreaChart";
import { HorizontalBars } from "@/components/admin/charts/HorizontalBars";
import { Donut } from "@/components/admin/charts/Donut";

export const metadata: Metadata = { title: "Dashboard" };

// Always render fresh figures.
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

export default async function AdminDashboardPage() {
  await requireAdmin();
  const m = await getDashboardMetrics(WINDOW_DAYS);

  const ws = m.activeWhitelist;
  const os = m.orderStatus;

  return (
    <section className="flex flex-col gap-s4">
      <PageHeader
        kicker="Overview"
        title="Dashboard"
        subtitle={`ภาพรวมระบบ ${WINDOW_DAYS} วันล่าสุด · เทียบกับช่วงก่อนหน้า`}
      />

      {/* ── KPI row ──────────────────────────────────────────── */}
      <ul className="grid grid-cols-2 gap-s3 lg:grid-cols-4">
        <KpiCard
          label="Revenue"
          value={formatTHB(m.revenue.value)}
          deltaPct={m.revenue.deltaPct}
          previous={formatTHB(m.revenue.previous)}
          icon={Coins}
        />
        <KpiCard
          label="Paid orders"
          value={m.paidOrders.value.toLocaleString()}
          deltaPct={m.paidOrders.deltaPct}
          previous={`${m.paidOrders.previous} prev`}
          icon={Receipt}
        />
        <KpiCard
          label="New customers"
          value={m.newCustomers.value.toLocaleString()}
          deltaPct={m.newCustomers.deltaPct}
          previous={`${m.newCustomers.previous} prev`}
          icon={Users}
        />
        <KpiCard
          label="Active whitelist"
          value={ws.value.toLocaleString()}
          previous={`${ws.lifetime} lifetime · ${ws.duration} timed`}
          icon={ScrollText}
        />
      </ul>

      {/* ── Revenue trend ────────────────────────────────────── */}
      <section className="panel rounded-md p-s3 sm:p-s4">
        <header className="mb-s2 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-fg-light">Revenue trend</h2>
            <p className="text-[12px] text-fg-light-mute">
              ยอดขายรายวัน {WINDOW_DAYS} วันล่าสุด (เฉพาะออเดอร์สถานะ PAID)
            </p>
          </div>
          <span className="hidden items-center gap-1.5 text-[12px] text-fg-light-soft sm:inline-flex">
            <TrendingUp size={14} strokeWidth={2} className="text-pink-500" />
            {formatTHB(m.revenue.value)}
          </span>
        </header>
        <div className="text-fg-light">
          <RevenueAreaChart data={m.revenueSeries} />
        </div>
      </section>

      {/* ── Top products + Donut row ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-s4 lg:grid-cols-3">
        <section className="panel rounded-md p-s3 sm:p-s4 lg:col-span-2">
          <header className="mb-s3">
            <h2 className="text-[14px] font-semibold text-fg-light">Top products</h2>
            <p className="text-[12px] text-fg-light-mute">
              จัดอันดับตามรายได้รวมในช่วงเวลานี้
            </p>
          </header>
          <HorizontalBars
            items={m.topProducts.map((p) => ({
              label: p.name,
              value: p.revenue,
              secondary: `${p.orders} order${p.orders === 1 ? "" : "s"}`,
            }))}
          />
        </section>

        <section className="panel rounded-md p-s3 sm:p-s4">
          <header className="mb-s3">
            <h2 className="text-[14px] font-semibold text-fg-light">Whitelist breakdown</h2>
            <p className="text-[12px] text-fg-light-mute">สถานะปัจจุบันของไวลิสต์ทั้งระบบ</p>
          </header>
          <Donut
            segments={[
              { label: "Lifetime", value: ws.lifetime, color: "rgb(236 72 153)" },
              { label: "Active",   value: ws.duration, color: "rgb(56 189 248)" },
              { label: "Expired",  value: ws.expired,  color: "rgb(148 163 184)" },
            ]}
            centerLabel={ws.value.toLocaleString()}
            centerSub="ACTIVE"
          />
        </section>
      </div>

      {/* ── Order status + Recent orders row ─────────────────── */}
      <div className="grid grid-cols-1 gap-s4 lg:grid-cols-3">
        <section className="panel rounded-md p-s3 sm:p-s4">
          <header className="mb-s3">
            <h2 className="text-[14px] font-semibold text-fg-light">Order status</h2>
            <p className="text-[12px] text-fg-light-mute">การกระจายสถานะของออเดอร์ในช่วงนี้</p>
          </header>
          <Donut
            segments={[
              { label: "Paid",     value: os.paid,     color: "rgb(34 197 94)"  },
              { label: "Pending",  value: os.pending,  color: "rgb(245 158 11)" },
              { label: "Failed",   value: os.failed,   color: "rgb(244 63 94)"  },
              { label: "Refunded", value: os.refunded, color: "rgb(148 163 184)" },
            ]}
            centerLabel={(os.paid + os.pending + os.failed + os.refunded).toLocaleString()}
            centerSub="ORDERS"
          />
        </section>

        <section className="panel overflow-hidden rounded-md p-s3 sm:p-s4 lg:col-span-2">
          <header className="mb-s3 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-semibold text-fg-light">Recent orders</h2>
              <p className="text-[12px] text-fg-light-mute">รายการสั่งซื้อล่าสุด 8 รายการ</p>
            </div>
            <Link
              href="/admin/transactions"
              className="text-[12px] font-semibold text-pink-500 hover:underline"
            >
              View all →
            </Link>
          </header>

          {m.recentOrders.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-fg-light-mute">ยังไม่มีออเดอร์</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-fg-light-mute">
                    <th className="pb-1.5 font-medium">Product</th>
                    <th className="pb-1.5 font-medium">User</th>
                    <th className="pb-1.5 font-medium">Method</th>
                    <th className="pb-1.5 font-medium">Status</th>
                    <th className="pb-1.5 text-right font-medium">Amount</th>
                    <th className="pb-1.5 text-right font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="text-fg-light">
                  {m.recentOrders.map((o) => (
                    <tr key={o.id} className="border-t border-line-light/50">
                      <td className="py-2 pr-2">
                        <span className="block max-w-[180px] truncate font-medium">{o.productName}</span>
                      </td>
                      <td className="py-2 pr-2 text-fg-light-soft">{o.username}</td>
                      <td className="py-2 pr-2">
                        <span className="font-medium text-fg-light-soft">
                          {o.paymentMethod === "CARD" ? "Card" : "PromptPay"}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className="py-2 pl-2 text-right tabular-nums">
                        {formatTHB(o.amount)}
                      </td>
                      <td className="py-2 pl-2 text-right text-fg-light-mute">
                        {timeAgo(o.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

    </section>
  );
}

// ── helpers ────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  deltaPct,
  previous,
  icon: Icon,
}: {
  label: string;
  value: string;
  deltaPct?: number;
  previous?: string;
  icon: typeof Package;
}) {
  const up = (deltaPct ?? 0) >= 0;
  const showDelta = typeof deltaPct === "number" && Number.isFinite(deltaPct);
  return (
    <li className="panel rounded-md p-s3">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[10px] font-extrabold uppercase tracking-[0.16em] text-fg-light-mute">
          {label}
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-md bg-pink-500/10 text-pink-500">
          <Icon size={14} strokeWidth={2} />
        </span>
      </div>
      <p className="mt-2 font-display text-[26px] leading-tight text-fg-light sm:text-[30px]">
        {value}
      </p>
      <div className="mt-1 flex items-center gap-2 text-[11px]">
        {showDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold",
              up
                ? "bg-[hsl(150_55%_45%/0.18)] text-[hsl(150_55%_38%)]"
                : "bg-[hsl(0_75%_55%/0.18)] text-[hsl(0_70%_50%)]",
            )}
          >
            {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(deltaPct).toFixed(0)}%
          </span>
        )}
        {previous && <span className="text-fg-light-mute">{previous}</span>}
      </div>
    </li>
  );
}

function OrderStatusBadge({ status }: { status: "PAID" | "PENDING" | "FAILED" | "REFUNDED" }) {
  if (status === "PAID")     return <StatusBadge tone="ok">PAID</StatusBadge>;
  if (status === "PENDING")  return <StatusBadge tone="warn">PENDING</StatusBadge>;
  if (status === "FAILED")   return <StatusBadge tone="accent">FAILED</StatusBadge>;
  return <StatusBadge tone="muted">REFUNDED</StatusBadge>;
}

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)    return "just now";
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
