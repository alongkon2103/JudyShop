import type { Metadata } from "next";
import {
  BadgePercent,
  KeyRound,
  ShieldOff,
  WifiOff,
  ServerCrash,
  Ticket,
  Receipt,
  Wallet,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  getAffiliateDashboard,
  fmtAffMoney,
  fmtAffDate,
  type AffiliateResult,
  type AffiliateDashboard,
} from "@/lib/affiliate";

export const metadata: Metadata = { title: "Affiliate" };
// Money dashboard — always live, never cached.
export const dynamic = "force-dynamic";

// How many sale rows to render. The API returns up to 1000; showing them
// all would bloat the page, so we cap and note the remainder.
const SALES_LIMIT = 100;

export default async function AffiliatePage() {
  await requireAdmin();

  const result = await getAffiliateDashboard();

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="Affiliate"
        title="Affiliate Dashboard"
        subtitle="ยอดขายและค่าคอมมิชชั่นของคุณจากร้าน aclassstore — ข้อมูลเรียลไทม์ผ่าน API (อ่านอย่างเดียว)"
      />

      {result.ok ? <Dashboard data={result.data} /> : <ErrorState result={result} />}
    </section>
  );
}

// ── Error / setup states ─────────────────────────────────────────────

function ErrorState({ result }: { result: Extract<AffiliateResult, { ok: false }> }) {
  const map = {
    missing_key: {
      icon: <KeyRound size={20} />,
      title: "ยังไม่ได้ตั้งค่า API key",
      description:
        "ใส่คีย์ที่ aclassstore ออกให้ (ขึ้นต้นด้วย afk_) ลงใน env ตัวแปร AFFILIATE_API_KEY แล้ว deploy ใหม่ — ดูรายละเอียดใน docs/affiliate-api.md",
    },
    unauthorized: {
      icon: <ShieldOff size={20} />,
      title: "API key ไม่ถูกต้องหรือถูกยกเลิก",
      description:
        "aclassstore ปฏิเสธคีย์นี้ (401) — อาจถูก regenerate ไปแล้ว สร้างคีย์ใหม่ในแดชบอร์ด affiliate ของ aclassstore แล้วอัปเดต AFFILIATE_API_KEY",
    },
    forbidden: {
      icon: <ShieldOff size={20} />,
      title: "aclassstore ปิดการเข้าถึง API",
      description:
        "บัญชีนี้ยังไม่ได้เปิดสิทธิ์เรียก API (403) — ติดต่อแอดมิน aclassstore ให้เปิด API access ให้ก่อน",
    },
    network: {
      icon: <WifiOff size={20} />,
      title: "เชื่อมต่อ aclassstore ไม่ได้",
      description: "เรียก API ไม่สำเร็จ ลองรีเฟรชอีกครั้ง — ถ้ายังไม่ได้ อาจเป็นที่ฝั่ง aclassstore",
    },
    bad_response: {
      icon: <ServerCrash size={20} />,
      title: "aclassstore ตอบกลับผิดปกติ",
      description: "รูปแบบข้อมูลที่ได้ไม่ตรงที่คาด ลองใหม่ภายหลัง",
    },
  } as const;

  const info = map[result.reason];
  return (
    <EmptyState
      icon={info.icon}
      title={info.title}
      description={
        info.description + (result.detail ? ` (${result.detail})` : "")
      }
    />
  );
}

// ── Main dashboard ───────────────────────────────────────────────────

function Dashboard({ data }: { data: AffiliateDashboard }) {
  const { profile, totals, codes, sales, payouts } = data;
  const cur = totals.currency || "THB";
  const shownSales = sales.slice(0, SALES_LIMIT);

  return (
    <div className="space-y-6">
      {/* Profile strip */}
      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-pink-500/12 text-pink-500">
            <BadgePercent size={20} strokeWidth={2} />
          </div>
          <div>
            <p className="font-display text-[18px] text-fg-light">
              {profile.display_name || "Affiliate"}
            </p>
            <p className="text-[12px] text-fg-light-soft">
              ค่าคอมมิชชั่นเริ่มต้น{" "}
              <span className="font-semibold text-fg-light">{profile.commission_pct}%</span>
            </p>
          </div>
        </div>
        <StatusBadge tone={profile.is_active ? "ok" : "muted"}>
          {profile.is_active ? "Active" : "Paused"}
        </StatusBadge>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Pending" value={fmtAffMoney(totals.pending, cur)} tone="pink" />
        <KpiCard label="Requested" value={fmtAffMoney(totals.requested, cur)} />
        <KpiCard label="Paid out" value={fmtAffMoney(totals.paid, cur)} tone="ok" />
        <KpiCard label="Sales" value={totals.sales_count.toLocaleString()} />
      </div>

      {/* Codes */}
      <Panel title="โค้ดส่วนลด / Referral codes" icon={<Ticket size={16} />}>
        {codes.length === 0 ? (
          <EmptyRow text="ยังไม่มีโค้ด" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-[13px]">
              <TableHead
                cols={[
                  "Code",
                  "ส่วนลดลูกค้า",
                  "Commission",
                  "Product",
                  "Uses",
                  "Status",
                ]}
              />
              <tbody className="divide-y divide-line-light text-fg-light">
                {codes.map((c) => (
                  <tr key={c.code} className="hover:bg-paper-2/30">
                    <td className="px-4 py-3 font-mono text-[12px] font-semibold text-fg-light">
                      {c.code}
                    </td>
                    <td className="px-4 py-3 text-fg-light-soft">
                      {c.type === "fixed" ? fmtAffMoney(c.value, cur) : `${c.value}%`}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {c.commission_pct ?? profile.commission_pct}%
                      {c.commission_pct == null && (
                        <span className="ml-1 text-[11px] text-fg-light-mute">(default)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-fg-light-soft">{c.product ?? "ทุกสินค้า"}</td>
                    <td className="px-4 py-3 tabular-nums text-fg-light-soft">
                      {c.used_count.toLocaleString()}
                      {c.max_uses != null ? ` / ${c.max_uses.toLocaleString()}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={c.is_active ? "ok" : "muted"}>
                        {c.is_active ? "Active" : "Off"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Sales */}
      <Panel
        title="รายการขาย / Sales"
        icon={<Receipt size={16} />}
        note={
          sales.length > SALES_LIMIT
            ? `แสดง ${SALES_LIMIT} รายการล่าสุด จากทั้งหมด ${sales.length.toLocaleString()}`
            : undefined
        }
      >
        {shownSales.length === 0 ? (
          <EmptyRow text="ยังไม่มีรายการขาย" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-[13px]">
              <TableHead
                cols={["วันที่", "Product", "ยอดขาย", "Comm %", "ค่าคอม", "Status"]}
                rightFrom={2}
              />
              <tbody className="divide-y divide-line-light text-fg-light">
                {shownSales.map((s, i) => (
                  <tr key={`${s.date}-${i}`} className="hover:bg-paper-2/30">
                    <td className="px-4 py-3 whitespace-nowrap text-fg-light-soft">
                      {fmtAffDate(s.date)}
                    </td>
                    <td className="px-4 py-3">{s.product ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-fg-light-soft">
                      {fmtAffMoney(s.sale_amount, cur)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-fg-light-soft">
                      {s.commission_pct}%
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-pink-500">
                      {fmtAffMoney(s.commission, cur)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={saleTone(s.status)}>{s.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Payouts */}
      <Panel title="การจ่ายเงิน / Payouts" icon={<Wallet size={16} />}>
        {payouts.length === 0 ? (
          <EmptyRow text="ยังไม่มีการจ่ายเงิน" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <TableHead
                cols={["ขอเมื่อ", "ช่องทาง", "จำนวน", "Status", "จ่ายเมื่อ"]}
                rightFrom={2}
                rightUntil={2}
              />
              <tbody className="divide-y divide-line-light text-fg-light">
                {payouts.map((p, i) => (
                  <tr key={`${p.requested_at}-${i}`} className="hover:bg-paper-2/30">
                    <td className="px-4 py-3 whitespace-nowrap text-fg-light-soft">
                      {fmtAffDate(p.requested_at)}
                    </td>
                    <td className="px-4 py-3 text-fg-light-soft">{p.method ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-fg-light">
                      {fmtAffMoney(p.amount, cur)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={payoutTone(p.status)}>{p.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-fg-light-soft">
                      {fmtAffDate(p.paid_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ── Small building blocks ────────────────────────────────────────────

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pink" | "ok";
}) {
  const valueClass =
    tone === "pink"
      ? "mt-1 font-display text-[22px] text-pink-500"
      : tone === "ok"
        ? "mt-1 font-display text-[22px] text-[hsl(150_55%_38%)]"
        : "mt-1 font-display text-[22px] text-fg-light";
  return (
    <div className="panel rounded-xl p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-light-mute">
        {label}
      </p>
      <p className={valueClass}>{value}</p>
    </div>
  );
}

function Panel({
  title,
  icon,
  note,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
          <span className="text-fg-light-mute">{icon}</span>
          {title}
        </h2>
        {note && <span className="text-[11px] text-fg-light-mute">{note}</span>}
      </div>
      <div className="panel overflow-hidden rounded-xl">{children}</div>
    </div>
  );
}

function TableHead({
  cols,
  rightFrom,
  rightUntil,
}: {
  cols: string[];
  /** Index from which columns are right-aligned (numeric columns). */
  rightFrom?: number;
  /** Last index (inclusive) to right-align; defaults to the last column. */
  rightUntil?: number;
}) {
  const last = rightUntil ?? cols.length - 1;
  return (
    <thead className="border-b border-line-light bg-paper-2/40 text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
      <tr>
        {cols.map((c, i) => {
          const right = rightFrom != null && i >= rightFrom && i <= last;
          return (
            <th key={c} className={`px-4 py-2.5 font-semibold ${right ? "text-right" : ""}`}>
              {c}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-4 py-6 text-center text-[13px] text-fg-light-soft">{text}</p>;
}

// ── Status → badge tone ──────────────────────────────────────────────

function saleTone(status: string): "ok" | "warn" | "info" | "muted" {
  if (status === "paid") return "ok";
  if (status === "pending") return "warn";
  if (status === "requested") return "info";
  return "muted"; // reversed / unknown
}

function payoutTone(status: string): "ok" | "warn" | "info" | "muted" {
  if (status === "paid") return "ok";
  if (status === "requested") return "info";
  if (status === "rejected") return "warn";
  return "muted"; // cancelled / unknown
}
