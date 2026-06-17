"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  selectedMonth: string;   // "YYYY-MM"
};

const MONTH_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** Navigate via ?month=YYYY-MM — no full reload, lets the server
 *  component re-run with the new range. Prev / Next walk one month. */
export function MonthPicker({ selectedMonth }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [y, m] = selectedMonth.split("-").map(Number);

  const navigateBy = (delta: number) => {
    let year = y;
    let month = m + delta;
    if (month < 1) { month += 12; year -= 1; }
    if (month > 12) { month -= 12; year += 1; }
    const key = `${year}-${String(month).padStart(2, "0")}`;
    startTransition(() => router.replace(`/admin/finance?month=${key}`, { scroll: false }));
  };

  const handleNative = (value: string) => {
    if (!value) return;
    startTransition(() => router.replace(`/admin/finance?month=${value}`, { scroll: false }));
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
      <label className="relative inline-flex items-center">
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => handleNative(e.target.value)}
          disabled={pending}
          className="appearance-none rounded-full border border-line-light bg-paper px-3 py-1.5 text-[12px] font-semibold text-fg-light focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 disabled:opacity-60"
          aria-label="Select month"
        />
        <span className="pointer-events-none ml-2 hidden text-[12px] font-semibold text-fg-light sm:inline">
          {MONTH_TH[m - 1]} {y}
        </span>
      </label>
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
