import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Pagination } from "@/components/admin/Pagination";
import { RefundButton } from "./RefundButton";

export const metadata: Metadata = { title: "Transactions" };

const PAGE_SIZE = 50;

function pageFromQuery(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

const STATUS_TONES = {
  PAID:     "ok",
  PENDING:  "warn",
  FAILED:   "muted",
  REFUNDED: "accent",
} as const;

function fmtMoney(amount: number, currency: string) {
  if (currency === "THB") {
    return `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: Date) {
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type SearchParams = { status?: string; page?: string };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();

  const status = (searchParams.status ?? "").toUpperCase();
  const STATUSES = ["PAID", "PENDING", "FAILED", "REFUNDED"] as const;
  const filterStatus = STATUSES.find((s) => s === status);
  const page = pageFromQuery(searchParams.page);

  const where = filterStatus ? { status: filterStatus } : undefined;

  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        product: { select: { slug: true, nameEn: true } },
        plan:    { select: { labelEn: true } },
      },
    }),
    db.order.count({ where }),
  ]);

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="Operations"
        title="Transactions"
        subtitle={`รายการชำระเงินทั้งหมด — ${total} total`}
      />

      {/* Status filter pills */}
      <div className="panel flex flex-wrap items-center gap-1 rounded-full p-1">
        <FilterPill href="/admin/transactions" label="All" active={!filterStatus} />
        {STATUSES.map((s) => (
          <FilterPill
            key={s}
            href={`/admin/transactions?status=${s.toLowerCase()}`}
            label={s}
            active={filterStatus === s}
          />
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Receipt size={20} />}
          title="No transactions yet"
          description="ออเดอร์จะปรากฏที่นี่หลังจากระบบ Stripe checkout ทำงาน"
        />
      ) : (
        <div className="panel overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
              <thead className="border-b border-line-light bg-paper-2/40 text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Product · Plan</th>
                  <th className="px-4 py-2.5 font-semibold">User</th>
                  <th className="px-4 py-2.5 font-semibold">Method</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5 font-semibold">Stripe</th>
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light text-fg-light">
                {rows.map((o) => (
                  <tr key={o.id} className="align-middle hover:bg-paper-2/30">
                    <td className="px-4 py-3">
                      <StatusBadge tone={STATUS_TONES[o.status]}>{o.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate text-[13px] font-semibold text-fg-light">
                        {o.product.nameEn}
                      </p>
                      <p className="truncate text-[11px] text-fg-light-soft">{o.plan.labelEn}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-fg-light">
                      {o.username}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-fg-light-soft">
                      {o.paymentMethod === "CARD" ? "Card" : "PromptPay"}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums">
                      {fmtMoney(Number(o.amount), o.currency)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-fg-light-mute">
                      <span className="block max-w-[200px] truncate" title={o.stripePaymentId ?? o.stripeSessionId ?? ""}>
                        {o.stripePaymentId ?? o.stripeSessionId ?? "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[11px] text-fg-light-soft">
                      {fmtDate(o.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {o.status === "PAID" && o.stripePaymentId ? (
                        <RefundButton
                          orderId={o.id}
                          amount={fmtMoney(Number(o.amount), o.currency)}
                          username={o.username}
                          stripePaymentId={o.stripePaymentId}
                          paymentMethod={o.paymentMethod === "CARD" ? "Card" : "PromptPay"}
                          productName={o.product.nameEn}
                          planLabel={o.plan.labelEn}
                        />
                      ) : (
                        <span className="text-[11px] text-fg-light-mute">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            basePath="/admin/transactions"
            query={{ status: filterStatus?.toLowerCase() }}
          />
        </div>
      )}
    </section>
  );
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-pink-500 px-4 py-1.5 text-[12px] font-semibold text-white"
          : "rounded-full px-4 py-1.5 text-[12px] font-semibold text-fg-light-soft hover:bg-paper-2 hover:text-fg-light"
      }
    >
      {label}
    </Link>
  );
}
