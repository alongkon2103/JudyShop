"use client";

import { useMemo, useState } from "react";
import { Receipt, Search, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { fmtAffMoney, fmtAffDate } from "@/lib/affiliate-format";
import type { AffiliateSale } from "@/lib/affiliate";

// Guard against pathological row counts blowing up the DOM. The API caps
// at 1000; searching narrows it, but we still cap what we render.
const RENDER_LIMIT = 200;

type SortDir = "none" | "asc" | "desc";

function saleTone(status: string): "ok" | "warn" | "info" | "muted" {
  if (status === "paid") return "ok";
  if (status === "pending") return "warn";
  if (status === "requested") return "info";
  return "muted"; // reversed / unknown
}

export function SalesTable({
  sales,
  currency,
}: {
  sales: AffiliateSale[];
  currency: string;
}) {
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("none");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = sales;
    if (q) {
      rows = rows.filter((s) =>
        [s.product, s.whitelisted_username, s.email].some((v) =>
          (v ?? "").toLowerCase().includes(q),
        ),
      );
    }
    if (sortDir !== "none") {
      rows = [...rows].sort((a, b) => {
        const cmp = (a.product ?? "").localeCompare(b.product ?? "", "th");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [sales, query, sortDir]);

  const shown = filtered.slice(0, RENDER_LIMIT);
  const isFiltering = query.trim() !== "" || sortDir !== "none";

  // Product header cycles: none → asc → desc → none.
  const cycleSort = () =>
    setSortDir((d) => (d === "none" ? "asc" : d === "asc" ? "desc" : "none"));

  return (
    <div className="space-y-3">
      {/* Header: title · count · search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
          <span className="text-fg-light-mute">
            <Receipt size={16} />
          </span>
          รายการขาย / Sales
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-fg-light-mute">
            {isFiltering
              ? `${filtered.length.toLocaleString()} / ${sales.length.toLocaleString()} รายการ`
              : `${sales.length.toLocaleString()} รายการ`}
          </span>
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-light-mute"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหา สินค้า / username / email"
              className="w-[200px] rounded-full border border-line-light bg-paper-2 py-1.5 pl-8 pr-3 text-[12px] text-fg-light placeholder:text-fg-light-mute focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/25 sm:w-[280px]"
            />
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden rounded-xl">
        {shown.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-fg-light-soft">
            {sales.length === 0 ? "ยังไม่มีรายการขาย" : "ไม่พบรายการที่ค้นหา"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-left text-[13px]">
              <thead className="border-b border-line-light bg-paper-2/40 text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">วันที่</th>
                  <th className="px-4 py-2.5 font-semibold">
                    <button
                      type="button"
                      onClick={cycleSort}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.06em] transition-colors hover:text-fg-light"
                      title="เรียงตามสินค้า"
                    >
                      Product
                      {sortDir === "asc" ? (
                        <ArrowUp size={12} className="text-pink-500" />
                      ) : sortDir === "desc" ? (
                        <ArrowDown size={12} className="text-pink-500" />
                      ) : (
                        <ChevronsUpDown size={12} className="opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-2.5 font-semibold">Whitelisted user</th>
                  <th className="px-4 py-2.5 font-semibold">Email</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ยอดขาย</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Comm %</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ค่าคอม</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light text-fg-light">
                {shown.map((s, i) => (
                  <tr key={`${s.date}-${i}`} className="hover:bg-paper-2/30">
                    <td className="whitespace-nowrap px-4 py-3 text-fg-light-soft">
                      {fmtAffDate(s.date)}
                    </td>
                    <td className="px-4 py-3">{s.product ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-[12px]">
                      {s.whitelisted_username ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-fg-light-soft">
                      <span
                        className="block max-w-[220px] truncate"
                        title={s.email ?? undefined}
                      >
                        {s.email ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-fg-light-soft">
                      {fmtAffMoney(s.sale_amount, currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-fg-light-soft">
                      {s.commission_pct}%
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-pink-500">
                      {fmtAffMoney(s.commission, currency)}
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
        {filtered.length > RENDER_LIMIT && (
          <p className="border-t border-line-light px-4 py-2 text-center text-[11px] text-fg-light-mute">
            แสดง {RENDER_LIMIT} จาก {filtered.length.toLocaleString()} รายการ — ใช้ช่องค้นหาเพื่อกรองให้แคบลง
          </p>
        )}
      </div>
    </div>
  );
}
