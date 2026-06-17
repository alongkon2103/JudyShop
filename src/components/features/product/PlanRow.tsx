import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTHB, formatUSD } from "@/lib/format";
import type { PricingPlan } from "@/types";

type Props = {
  plan: PricingPlan;
  selected: boolean;
  onSelect: (id: string) => void;
};

/** Kawaii pill plan — rounded full, chunky radio + price. */
export function PlanRow({ plan, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(plan.id)}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-full px-4 py-3 text-left sm:px-5",
        "border-2 transition-all duration-fast ease-spring hover:scale-[1.01]",
        selected
          ? "border-pink-400 bg-paper-2"
          : "border-line-light bg-paper-2/60 hover:border-violet-400",
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
            selected
              ? "border-pink-400 bg-pink-400 text-white"
              : "border-line-light bg-transparent text-transparent",
          )}
        >
          {selected && <Check className="anim-checkmark-pop h-3 w-3" strokeWidth={3} />}
        </span>
        <span className="truncate font-sans text-[13px] font-extrabold uppercase tracking-[0.06em] text-fg-light sm:text-[14px]">
          {plan.label}
        </span>
      </span>
      <span className="shrink-0 whitespace-nowrap font-sans text-[14px] font-extrabold text-pink-400 sm:text-[16px]">
        {formatTHB(plan.priceTHB)}
        <span className="hidden font-bold text-fg-light-mute sm:inline">
          {" "}/ {formatUSD(plan.priceUSD)}
        </span>
      </span>
    </button>
  );
}
