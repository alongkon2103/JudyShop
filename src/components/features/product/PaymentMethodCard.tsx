"use client";

import { Check, CreditCard, QrCode, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { PaymentMethod } from "@/types";

const ICONS: Record<PaymentMethod, typeof QrCode> = {
  promptpay: QrCode,
  card:      CreditCard,
  paypal:    Wallet,
};

type Props = {
  method: PaymentMethod;
  selected: boolean;
  onSelect: (m: PaymentMethod) => void;
  /** Card surcharge percentage — drives the card subtitle copy. */
  cardFeePercent: number;
  /** PayPal surcharge percentage — drives the paypal subtitle copy. */
  paypalFeePercent: number;
};

/** Kawaii payment tile — rounded chunky, with check corner on selected. */
export function PaymentMethodCard({ method, selected, onSelect, cardFeePercent, paypalFeePercent }: Props) {
  const t = useTranslations("product");
  const Icon = ICONS[method];

  const title =
    method === "promptpay" ? t("promptpayTitle") :
    method === "card"      ? t("cardTitle") :
    /* paypal */             t("paypalTitle");

  const subtitle =
    method === "promptpay" ? t("promptpaySubtitle") :
    method === "card"
      ? (cardFeePercent > 0
          ? t("cardSubtitleFee", { pct: formatFee(cardFeePercent) })
          : t("cardSubtitleNoFee"))
      : /* paypal */ (paypalFeePercent > 0
          ? t("paypalSubtitleFee", { pct: formatFee(paypalFeePercent) })
          : t("paypalSubtitleNoFee"));

  return (
    <button
      type="button"
      onClick={() => onSelect(method)}
      aria-pressed={selected}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-md border-2 p-3 text-left sm:p-4",
        "transition-all duration-fast ease-spring hover:scale-[1.02]",
        selected ? "border-pink-400 bg-paper-2" : "border-line-light bg-paper-2/60 hover:border-violet-400",
      )}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-violet-400/20 text-violet-300 sm:h-12 sm:w-12">
        <Icon size={20} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-sans text-[14px] font-extrabold text-fg-light sm:text-[15px]">{title}</span>
        <span className="block font-sans text-[12px] font-medium leading-snug text-fg-light-soft sm:text-[13px]">{subtitle}</span>
      </span>
      {selected && (
        <span
          aria-hidden
          className="anim-checkmark-pop absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-pink-400 text-white"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** Trim trailing zeros so 3.00 → "3" and 2.50 → "2.5". */
function formatFee(pct: number): string {
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, "");
}
