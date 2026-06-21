"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CreditCard, QrCode, Wallet } from "lucide-react";
import { Field, inputClass } from "@/components/admin/Form";
import { useToast } from "@/components/admin/toast/ToastContext";
import { saveSettings } from "./_actions";

type Initial = {
  cardFeePercent: number;
  paypalFeePercent: number;
  promptpayEnabled: boolean;
  cardEnabled: boolean;
  paypalEnabled: boolean;
};

export function SettingsForm({ initial }: { initial: Initial }) {
  const [cardPct, setCardPct]     = useState(initial.cardFeePercent);
  const [paypalPct, setPaypalPct] = useState(initial.paypalFeePercent);
  const [promptpayOn, setPromptpayOn] = useState(initial.promptpayEnabled);
  const [cardOn, setCardOn]           = useState(initial.cardEnabled);
  const [paypalOn, setPaypalOn]       = useState(initial.paypalEnabled);
  const toast = useToast();

  const action = async (formData: FormData) => {
    if (!promptpayOn && !cardOn && !paypalOn) {
      toast.error("ต้องเปิดอย่างน้อย 1 ช่องทาง");
      return;
    }
    try {
      await saveSettings(formData);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  // Live preview on a hypothetical ฿1,000 cart.
  const sample = 1000;
  const cardFee   = cardPct   > 0 ? Math.round(sample * cardPct)   / 100 : 0;
  const paypalFee = paypalPct > 0 ? Math.round(sample * paypalPct) / 100 : 0;

  return (
    <form action={action} className="space-y-6">
      {/* ── Payment method toggles ───────────────────────────── */}
      <div className="space-y-2">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-fg-light-mute">
          Payment methods
        </p>
        <p className="text-[12px] text-fg-light-soft">
          ปิดเฉพาะตัวที่มีปัญหาเพื่อหยุด traffic เข้า gateway นั้นโดยไม่ต้อง deploy ใหม่
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MethodToggle
            icon={<QrCode size={16} strokeWidth={2.25} />}
            name="promptpayEnabled"
            label="PromptPay"
            checked={promptpayOn}
            onChange={setPromptpayOn}
          />
          <MethodToggle
            icon={<CreditCard size={16} strokeWidth={2.25} />}
            name="cardEnabled"
            label="Card (Stripe)"
            checked={cardOn}
            onChange={setCardOn}
          />
          <MethodToggle
            icon={<Wallet size={16} strokeWidth={2.25} />}
            name="paypalEnabled"
            label="PayPal"
            checked={paypalOn}
            onChange={setPaypalOn}
          />
        </div>
      </div>

      {/* ── Surcharges ───────────────────────────────────────── */}
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
          value={Number.isFinite(cardPct) ? cardPct : 0}
          onChange={(e) => setCardPct(Number(e.target.value))}
          className={inputClass}
        />
      </Field>

      <Field
        label="PayPal surcharge (%)"
        hint="มักจะสูงกว่า card เพราะมี cross-border + currency conversion"
      >
        <input
          name="paypalFeePercent"
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={Number.isFinite(paypalPct) ? paypalPct : 0}
          onChange={(e) => setPaypalPct(Number(e.target.value))}
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
          <dt className="text-fg-light-soft">Card fee ({cardPct.toFixed(2)} %)</dt>
          <dd className="text-right font-mono text-fg-light">+฿{cardFee.toFixed(2)}</dd>
          <dt className="font-semibold text-fg-light">Total (card)</dt>
          <dd className="text-right font-mono font-semibold text-pink-500">
            ฿{(sample + cardFee).toFixed(2)}
          </dd>
          <dt className="text-fg-light-soft">PayPal fee ({paypalPct.toFixed(2)} %)</dt>
          <dd className="text-right font-mono text-fg-light">+฿{paypalFee.toFixed(2)}</dd>
          <dt className="font-semibold text-fg-light">Total (PayPal)</dt>
          <dd className="text-right font-mono font-semibold text-pink-500">
            ฿{(sample + paypalFee).toFixed(2)}
          </dd>
        </dl>
      </div>

      <div className="flex justify-end">
        <Submit />
      </div>
    </form>
  );
}

function MethodToggle({
  icon,
  name,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  name: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  // Native checkbox stays as the form field (server reads "on"/missing
  // exactly like the standalone <Switch>), but it's `sr-only` and the
  // visible switch track/thumb below is the real UI. Whole card is
  // clickable via the wrapping <label>.
  return (
    <label
      className={
        "group flex cursor-pointer items-center gap-2.5 rounded-md border-2 px-3 py-2.5 transition-all duration-fast " +
        (checked
          ? "border-pink-400 bg-pink-500/10"
          : "border-line-light bg-paper-2 hover:border-violet-400")
      }
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className={"grid h-7 w-7 place-items-center rounded " + (checked ? "bg-pink-500 text-white" : "bg-paper-3 text-fg-light-soft")}>
        {icon}
      </span>
      <span className="flex-1 text-[13px] font-semibold text-fg-light">{label}</span>
      {/* Switch track */}
      <span
        aria-hidden
        className={
          "relative inline-block h-5 w-9 shrink-0 rounded-full border transition-colors duration-fast " +
          "peer-focus-visible:ring-2 peer-focus-visible:ring-pink-400/40 " +
          (checked
            ? "border-pink-500 bg-pink-500"
            : "border-line-light bg-paper-3")
        }
      >
        <span
          className={
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-fast ease-spring " +
            (checked ? "translate-x-4" : "translate-x-0")
          }
        />
      </span>
    </label>
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
