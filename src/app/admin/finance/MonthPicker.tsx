"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  selectedMonth: string;   // "YYYY-MM"
  /** Route this picker drives — "/admin/finance" or "/partner/finance". */
  basePath: string;
};

/** Navigate via ?month=YYYY-MM — no full reload, lets the server
 *  component re-run with the new range. Prev / Next walk one month. */
export function MonthPicker({ selectedMonth, basePath }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [y, m] = selectedMonth.split("-").map(Number);

  const navigateBy = (delta: number) => {
    let year = y;
    let month = m + delta;
    if (month < 1) { month += 12; year -= 1; }
    if (month > 12) { month -= 12; year += 1; }
    const key = `${year}-${String(month).padStart(2, "0")}`;
    startTransition(() => router.replace(`${basePath}?month=${key}`, { scroll: false }));
  };

  const handleNative = (value: string) => {
    if (!value) return;
    startTransition(() => router.replace(`${basePath}?month=${value}`, { scroll: false }));
  };

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-paper-2 p-1">
      <button
        type="button"
        onClick={() => navigateBy(-1)}
        disabled={pending}
        aria-label="Previous month"
        className="grid h-8 w-8 place-items-center rounded-full text-fg-light-soft hover:bg-paper hover:text-fg-light disabled:opacity-60"
      >
        <ChevronLeft size={16} strokeWidth={2.25} />
      </button>
      {/* Native <input type="month"> renders the locale-formatted label
          itself (e.g. "มิถุนายน 2026" on Chrome with Thai locale), so we
          don't add a sibling <span> — that's what caused the duplicate. */}
      <input
        type="month"
        value={selectedMonth}
        onChange={(e) => handleNative(e.target.value)}
        disabled={pending}
        className="appearance-none rounded-full border border-line-light bg-paper px-3 py-1.5 text-[12px] font-semibold text-fg-light focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 disabled:opacity-60"
        aria-label="Select month"
      />
      <button
        type="button"
        onClick={() => navigateBy(1)}
        disabled={pending}
        aria-label="Next month"
        className="grid h-8 w-8 place-items-center rounded-full text-fg-light-soft hover:bg-paper hover:text-fg-light disabled:opacity-60"
      >
        <ChevronRight size={16} strokeWidth={2.25} />
      </button>
    </div>
  );
}
