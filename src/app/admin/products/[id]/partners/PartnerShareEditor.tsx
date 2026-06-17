"use client";

import { useState, useTransition } from "react";
import { Plus, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/admin/toast/ToastContext";
import { cn } from "@/lib/cn";
import { setProductPartners } from "./_actions";

type Partner = {
  id: string;
  name: string;
  contact: string | null;
};

type Row = {
  partnerId: string;
  sharePercent: number;
};

type Props = {
  productId: string;
  productName: string;
  partners: Partner[];                // every partner that exists
  initialRows: Row[];                 // current allocation for this product
};

const TOLERANCE = 0.0001;

/**
 * Edit a product's revenue-share allocation. Lets the admin add rows
 * (Partner + %), pick from the global Partner list, edit values, or
 * remove rows. The "เงินกลาง" indicator updates live so the admin can
 * see exactly what the shared pool gets without doing math in their
 * head.
 */
export function PartnerShareEditor({
  productId,
  productName,
  partners,
  initialRows,
}: Props) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const used = new Set(rows.map((r) => r.partnerId));
  const available = partners.filter((p) => !used.has(p.id));

  const sum = rows.reduce((s, r) => s + (Number.isFinite(r.sharePercent) ? r.sharePercent : 0), 0);
  const pool = Math.max(0, 100 - sum);
  const overAllocated = sum > 100 + TOLERANCE;
  const hasInvalidRow = rows.some((r) => !r.sharePercent || r.sharePercent <= 0);

  const addRow = (partnerId: string) => {
    setRows([...rows, { partnerId, sharePercent: 0 }]);
  };
  const removeRow = (partnerId: string) => {
    setRows(rows.filter((r) => r.partnerId !== partnerId));
  };
  const updatePercent = (partnerId: string, raw: string) => {
    const value = Number(raw);
    setRows(rows.map((r) => (r.partnerId === partnerId ? { ...r, sharePercent: value } : r)));
  };

  const handleSave = () => {
    if (overAllocated) {
      toast.error("Share % รวมเกิน 100 — ลดลงก่อนบันทึก");
      return;
    }
    if (hasInvalidRow) {
      toast.error("มีแถวที่ % ยังว่างหรือเป็น 0 — ใส่ค่าหรือลบแถวออก");
      return;
    }
    startTransition(async () => {
      const res = await setProductPartners({
        productId,
        rows: rows.map((r) => ({ partnerId: r.partnerId, sharePercent: r.sharePercent })),
      });
      if (res.ok) {
        toast.success("Share allocation saved");
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-s4">
      {partners.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-light bg-paper-2/40 p-s5 text-center">
          <p className="text-[13px] text-fg-light-soft">
            ยังไม่มี Partner ในระบบ —{" "}
            <a className="font-semibold text-pink-400 hover:underline" href="/admin/partners">
              เพิ่ม Partner ที่หน้านี้ก่อน
            </a>
          </p>
        </div>
      ) : (
        <>
          {/* Rows */}
          <div className="space-y-2">
            {rows.length === 0 && (
              <div className="rounded-lg border border-dashed border-line-light bg-paper-2/40 p-s4 text-center text-[12px] text-fg-light-soft">
                ยังไม่มี Partner ใส่ในเกมนี้ — เงินกลางได้ 100%
              </div>
            )}
            {rows.map((row) => {
              const partner = partners.find((p) => p.id === row.partnerId);
              if (!partner) return null;
              return (
                <div
                  key={row.partnerId}
                  className="flex items-center gap-2 rounded-lg border border-line-light bg-paper-2/50 p-s3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-fg-light">{partner.name}</p>
                    {partner.contact && (
                      <p className="truncate text-[11px] text-fg-light-mute">{partner.contact}</p>
                    )}
                  </div>
                  <label className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={row.sharePercent || ""}
                      onChange={(e) => updatePercent(row.partnerId, e.target.value)}
                      disabled={pending}
                      className="w-20 rounded-md border border-line-light bg-paper px-2 py-1.5 text-right text-[13px] font-semibold text-fg-light focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 disabled:opacity-60"
                    />
                    <span className="text-[12px] font-semibold text-fg-light-soft">%</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removeRow(row.partnerId)}
                    disabled={pending}
                    aria-label={`Remove ${partner.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line-light text-fg-light-soft hover:bg-pink-500/10 hover:text-pink-400 disabled:opacity-60"
                  >
                    <X size={14} strokeWidth={2.25} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add partner */}
          {available.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-fg-light-mute">
                Add partner:
              </span>
              {available.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addRow(p.id)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-full border border-pink-500/40 bg-pink-500/5 px-3 py-1.5 text-[12px] font-semibold text-pink-400 hover:bg-pink-500/15 disabled:opacity-60"
                >
                  <Plus size={11} strokeWidth={2.5} />
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Summary */}
          <div
            className={cn(
              "rounded-lg border-2 p-s4",
              overAllocated
                ? "border-pink-500 bg-pink-500/5"
                : "border-line-light bg-paper-2/50",
            )}
          >
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <p className="text-fg-light-mute">รวมที่จัดสรร</p>
                <p className={cn("font-display text-[22px]", overAllocated ? "text-pink-500" : "text-fg-light")}>
                  {sum.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-fg-light-mute">เงินกลาง (Shared pool)</p>
                <p className="font-display text-[22px] text-fg-light">
                  {pool.toFixed(2)}%
                </p>
              </div>
            </div>
            {overAllocated && (
              <p className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-pink-500">
                <AlertTriangle size={12} strokeWidth={2.5} />
                เกิน 100% — ลดลงก่อนบันทึก
              </p>
            )}
            {!overAllocated && pool === 0 && rows.length > 0 && (
              <p className="mt-2 text-[12px] text-fg-light-soft">
                ✓ Partner ได้รับทั้งหมด ไม่มีส่วนเข้าเงินกลาง
              </p>
            )}
            {!overAllocated && pool === 100 && rows.length === 0 && (
              <p className="mt-2 text-[12px] text-fg-light-soft">
                ยอดขายของ {productName} จะเข้าเงินกลางทั้งหมด
              </p>
            )}
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={pending || overAllocated || hasInvalidRow}
              className="inline-flex items-center gap-1.5 rounded-full bg-pink-500 px-6 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_2px_0_var(--pink-600)] transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
