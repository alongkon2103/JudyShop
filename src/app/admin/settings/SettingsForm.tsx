"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Field, inputClass } from "@/components/admin/Form";
import { useToast } from "@/components/admin/toast/ToastContext";
import { saveSettings } from "./_actions";

export function SettingsForm({ initial }: { initial: { cardFeePercent: number } }) {
  const [pct, setPct] = useState(initial.cardFeePercent);
  const toast = useToast();

  const action = async (formData: FormData) => {
    try {
      await saveSettings(formData);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  // Live preview on a hypothetical ฿1,000 cart.
  const sample = 1000;
  const fee = pct > 0 ? Math.round(sample * pct) / 100 : 0;
  const total = sample + fee;

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Credit card surcharge (%)"
        hint="ค่าธรรมเนียมที่บวกเพิ่มเมื่อจ่ายด้วยบัตร — 0 = ไม่คิดเพิ่ม"
      >
        <input
          name="cardFeePercent"
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={Number.isFinite(pct) ? pct : 0}
          onChange={(e) => setPct(Number(e.target.value))}
          className={inputClass}
        />
      </Field>

      {/* Live preview */}
      <div className="rounded-md border border-line-light bg-paper-2 p-3 text-[13px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-light-mute">
          Example — sample subtotal ฿{sample.toLocaleString()}
        </p>
        <dl className="mt-1 grid grid-cols-2 gap-1">
          <dt className="text-fg-light-soft">Subtotal</dt>
          <dd className="text-right font-mono text-fg-light">฿{sample.toFixed(2)}</dd>
          <dt className="text-fg-light-soft">Card fee ({pct.toFixed(2)} %)</dt>
          <dd className="text-right font-mono text-fg-light">+฿{fee.toFixed(2)}</dd>
          <dt className="font-semibold text-fg-light">Total (card)</dt>
          <dd className="text-right font-mono font-semibold text-pink-500">฿{total.toFixed(2)}</dd>
        </dl>
      </div>

      <div className="flex justify-end">
        <Submit />
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-pink-500 px-6 py-2.5 text-[12px] font-semibold text-white shadow-[0_2px_0_var(--pink-600)] transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save settings"}
    </button>
  );
}
