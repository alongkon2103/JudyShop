"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { AdminButton } from "@/components/admin/Button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ReorderButtons } from "@/components/admin/ReorderButtons";
import { PlanForm } from "./PlanForm";
import { deletePlan, movePlan } from "../_actions";

type Plan = {
  id: string;
  labelEn: string;
  labelTh: string;
  durationDays: number | null;
  isLifetime: boolean;
  priceTHB: number;
  priceUSD: number;
  usdAuto: boolean;
  isActive: boolean;
  displayOrder: number;
};

const fmtTHB = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PlanRow({
  productId,
  plan,
  canUp,
  canDown,
}: {
  productId: string;
  plan: Plan;
  canUp: boolean;
  canDown: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div>
        <div className="mb-s2 flex items-center justify-between">
          <p className="font-sans text-[12px] font-extrabold uppercase tracking-[0.12em] text-fg-light">Edit plan</p>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="grid h-7 w-7 place-items-center rounded-md text-fg-light-mute hover:bg-paper-2 hover:text-fg-light"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
        <PlanForm productId={productId} mode="edit" plan={plan} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-s3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-s2">
          <p className="font-display text-[17px] text-fg-light">{plan.labelEn}</p>
          <p className="font-sans text-[13px] font-bold text-fg-light-mute">· {plan.labelTh}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-s2 text-[12px] text-fg-light-soft">
          <span>
            ฿{fmtTHB(plan.priceTHB)}{" "}
            <span className="text-fg-light-mute">
              / ${fmtUSD(plan.priceUSD)}
              {plan.usdAuto && (
                <span className="ml-1 rounded-sm bg-cyan-400/15 px-1 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-cyan-500">
                  auto
                </span>
              )}
            </span>
          </span>
          <span className="text-fg-light-mute">·</span>
          <span>{plan.isLifetime ? "Lifetime" : `${plan.durationDays ?? "?"} days`}</span>
          <StatusBadge tone={plan.isActive ? "ok" : "muted"}>
            {plan.isActive ? "Active" : "Disabled"}
          </StatusBadge>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-s2">
        <ReorderButtons
          canUp={canUp}
          canDown={canDown}
          move={movePlan.bind(null, productId, plan.id)}
        />
        <AdminButton variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil size={12} strokeWidth={2.5} /> Edit
        </AdminButton>
        <DeleteButton
          title={`Delete plan "${plan.labelEn}"?`}
          description="แผนราคานี้จะถูกลบจากสินค้านี้ (จะลบไม่ได้ถ้ามี order ที่อ้างอิงอยู่)"
          successMessage="Plan deleted"
          action={deletePlan.bind(null, productId, plan.id)}
        />
      </div>
    </div>
  );
}
