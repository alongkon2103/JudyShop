"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { RefreshCcw } from "lucide-react";
import { Field, I18nField, inputClass } from "@/components/admin/Form";
import { Switch } from "@/components/admin/Switch";
import { useToast } from "@/components/admin/toast/ToastContext";
import { createPlan, previewUsdRate, updatePlan } from "../_actions";
import { cn } from "@/lib/cn";

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

type Props =
  | { productId: string; mode: "create"; plan?: undefined; onDone?: () => void }
  | { productId: string; mode: "edit"; plan: Plan; onDone?: () => void };

export function PlanForm(props: Props) {
  const { productId, mode } = props;
  const plan = mode === "edit" ? props.plan : null;
  const [isLifetime, setLifetime] = useState(plan?.isLifetime ?? false);
  const [usdAuto, setUsdAuto] = useState(plan?.usdAuto ?? true);
  const [priceTHB, setPriceTHB] = useState<string>(plan ? plan.priceTHB.toString() : "");
  const [priceUSD, setPriceUSD] = useState<string>(plan ? plan.priceUSD.toString() : "");
  const [rateInfo, setRateInfo] = useState<{ rate: number; source: "live" | "fallback" } | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const toast = useToast();

  // Recompute USD locally when THB changes if auto mode is on (only after we
  // know the rate from the server).
  const onChangeTHB = (v: string) => {
    setPriceTHB(v);
    if (usdAuto && rateInfo) {
      const n = parseFloat(v);
      if (Number.isFinite(n)) setPriceUSD((n * rateInfo.rate).toFixed(2));
    }
  };

  const refreshRate = () => {
    startRefresh(async () => {
      try {
        const r = await previewUsdRate();
        setRateInfo({ rate: r.rate, source: r.source });
        const n = parseFloat(priceTHB);
        if (usdAuto && Number.isFinite(n)) setPriceUSD((n * r.rate).toFixed(2));
        toast.success(
          `Rate updated: 1 THB ≈ ${r.rate.toFixed(5)} USD (${r.source})`,
        );
      } catch {
        toast.error("Could not fetch FX rate");
      }
    });
  };

  const action = async (formData: FormData) => {
    if (mode === "create") {
      await createPlan(productId, formData);
    } else {
      await updatePlan(productId, plan!.id, formData);
      props.onDone?.();
    }
  };

  return (
    <form action={action} className="space-y-s3">
      <I18nField
        label="Label"
        nameEn="labelEn"
        nameTh="labelTh"
        defaultValueEn={plan?.labelEn ?? ""}
        defaultValueTh={plan?.labelTh ?? ""}
        required
        maxLength={80}
        hint='e.g. "30 days" / "30 วัน"'
      />

      <div className="grid grid-cols-2 gap-s3 sm:grid-cols-4">
        <Field label="Price (THB)" hint="Decimals allowed.">
          <input
            name="priceTHB"
            type="number"
            min={0}
            step={0.01}
            inputMode="decimal"
            value={priceTHB}
            onChange={(e) => onChangeTHB(e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field
          label="Price (USD)"
          hint={
            usdAuto
              ? rateInfo
                ? `Auto · 1฿ ≈ $${rateInfo.rate.toFixed(5)} (${rateInfo.source})`
                : "Auto — refresh rate to preview"
              : "Manual."
          }
        >
          <input
            name="priceUSD"
            type="number"
            min={0}
            step={0.01}
            inputMode="decimal"
            value={priceUSD}
            onChange={(e) => setPriceUSD(e.target.value)}
            readOnly={usdAuto}
            className={cn(inputClass, usdAuto && "opacity-70")}
          />
        </Field>
        <Field label="Duration (days)" hint="Disabled when lifetime.">
          <input
            name="durationDays"
            type="number"
            min={0}
            disabled={isLifetime}
            defaultValue={plan?.durationDays ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Display order">
          <input
            name="displayOrder"
            type="number"
            min={0}
            defaultValue={plan?.displayOrder ?? 0}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-s4 pt-1">
        <Switch
          name="isLifetime"
          checked={isLifetime}
          onChange={setLifetime}
          label="Lifetime"
        />
        <Switch
          name="usdAuto"
          checked={usdAuto}
          onChange={setUsdAuto}
          label="Auto-convert USD"
        />
        <Switch
          name="isActive"
          defaultChecked={plan?.isActive ?? true}
          label="Active"
        />

        {usdAuto && (
          <button
            type="button"
            onClick={refreshRate}
            disabled={refreshing}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-line-light px-3 py-1.5 font-sans text-[11px] font-extrabold uppercase tracking-[0.12em] text-fg-light-soft transition-colors hover:bg-paper-2 hover:text-fg-light disabled:opacity-50"
          >
            <RefreshCcw size={12} strokeWidth={2.25} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Fetching…" : "Refresh rate"}
          </button>
        )}
      </div>

      <div className="flex items-center justify-end">
        <SubmitButton mode={mode} />
      </div>
    </form>
  );
}

function SubmitButton({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-pink-500 px-6 py-2.5 font-sans text-[12px] font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_3px_0_var(--pink-600)] transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60"
    >
      {pending ? (mode === "create" ? "Adding…" : "Saving…") : mode === "create" ? "Add plan" : "Save"}
    </button>
  );
}
