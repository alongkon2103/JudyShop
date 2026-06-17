import { formatTHB } from "@/lib/format";

type Item = {
  label: string;
  value: number;
  /** Secondary metric, e.g. order count. */
  secondary?: string;
};

type Props = {
  items: Item[];
  /** Format the value into a string for the right side. Defaults to formatTHB. */
  formatValue?: (v: number) => string;
  emptyText?: string;
};

/**
 * Lightweight horizontal-bar list. Each row: label · bar · value.
 * Bar widths are scaled relative to the max value in the list.
 */
export function HorizontalBars({
  items,
  formatValue = (v) => formatTHB(v),
  emptyText = "ยังไม่มีข้อมูล",
}: Props) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-[12px] text-fg-dark-mute">{emptyText}</p>;
  }

  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, i) => {
        const pct = Math.max(2, (item.value / max) * 100);
        return (
          <li key={i} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="truncate font-medium text-fg-dark">{item.label}</span>
              <span className="shrink-0 tabular-nums text-fg-dark-soft">
                {formatValue(item.value)}
                {item.secondary && (
                  <span className="ml-1.5 text-[11px] text-fg-dark-mute">
                    · {item.secondary}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-800">
              <div
                className="h-full rounded-full bg-pink-500/80"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
