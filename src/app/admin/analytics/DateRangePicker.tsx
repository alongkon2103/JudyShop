"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays } from "lucide-react";

type Props = {
  /** Currently-active preset key. */
  selectedPreset: string;
  /** Selected from / to in `YYYY-MM-DD`. Used to seed the custom inputs. */
  from: string;
  to: string;
};

const PRESETS: { key: string; label: string }[] = [
  { key: "all",         label: "ทั้งหมด" },
  { key: "today",       label: "วันนี้" },
  { key: "yesterday",   label: "เมื่อวาน" },
  { key: "7d",          label: "7 วัน" },
  { key: "30d",         label: "30 วัน" },
  { key: "this-month",  label: "เดือนนี้" },
  { key: "last-month",  label: "เดือนก่อน" },
];

/**
 * Two-row picker: quick presets on top, custom from/to range below.
 * Both routes update via `router.replace` with `scroll: false` so the
 * KPIs and chart refresh in place without jumping back to the top.
 */
export function DateRangePicker({ selectedPreset, from, to }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const setPreset = (key: string) => {
    startTransition(() => {
      router.replace(`/admin/analytics?preset=${key}`, { scroll: false });
    });
  };

  const applyCustom = (f: string, t: string) => {
    if (!f || !t) return;
    startTransition(() => {
      router.replace(`/admin/analytics?preset=custom&from=${f}&to=${t}`, { scroll: false });
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => {
          const active = selectedPreset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPreset(p.key)}
              disabled={pending}
              className={
                active
                  ? "rounded-full bg-pink-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_2px_0_var(--pink-600)] disabled:opacity-60"
                  : "rounded-full border border-line-light bg-paper-2 px-3 py-1.5 text-[11px] font-semibold text-fg-light-soft hover:bg-paper hover:text-fg-light disabled:opacity-60"
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-fg-light-mute">
        <CalendarDays size={12} strokeWidth={2.25} aria-hidden />
        <span>เลือกช่วงเอง:</span>
        <input
          type="date"
          value={from}
          onChange={(e) => applyCustom(e.target.value, to)}
          disabled={pending}
          aria-label="From date"
          className="rounded-md border border-line-light bg-paper px-2 py-1 text-fg-light focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 disabled:opacity-60"
        />
        <span>→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => applyCustom(from, e.target.value)}
          disabled={pending}
          aria-label="To date"
          className="rounded-md border border-line-light bg-paper px-2 py-1 text-fg-light focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 disabled:opacity-60"
        />
      </div>
    </div>
  );
}
