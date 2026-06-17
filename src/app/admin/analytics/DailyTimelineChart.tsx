import type { TimelinePoint } from "@/lib/analytics";

type Props = {
  points: TimelinePoint[];
};

/**
 * SVG bar chart. One bar per bucket (daily or monthly depending on
 * the chosen range). Two visual layers:
 *   - A light pink bar shows revenue (scaled to its own max).
 *   - A small deep-pink dot on top encodes the order count for that
 *     bucket. The dot uses a secondary y-axis so periods with a
 *     single pricey order still get a visible marker even when
 *     revenue is small relative to busier periods.
 *
 * Labels rotate to vertical when the range exceeds ~14 buckets so
 * the x-axis stays readable for long-history views.
 */
export function DailyTimelineChart({ points }: Props) {
  if (points.length === 0) {
    return (
      <p className="rounded-md border border-line-light bg-paper-2/40 px-3 py-6 text-center text-[12px] text-fg-light-soft">
        ไม่มีข้อมูลในช่วงที่เลือก
      </p>
    );
  }

  const W = 720;
  const H = 240;
  const pad = { top: 18, right: 14, bottom: 38, left: 54 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const groupW = innerW / points.length;
  const barW = Math.max(3, Math.min(28, groupW * 0.7));

  const maxRevenue = Math.max(1, ...points.map((p) => p.revenue));
  const maxOrders  = Math.max(1, ...points.map((p) => p.orders));
  const rotate     = points.length > 14;

  // Tick lines at 0%, 25%, 50%, 75%, 100% of revenue max.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    y: pad.top + innerH * (1 - p),
    revLabel: Math.round(maxRevenue * p).toLocaleString(),
  }));

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label="Daily revenue + order count timeline"
      >
        {/* Grid */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              y1={t.y}
              x2={W - pad.right}
              y2={t.y}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeWidth={1}
            />
            <text
              x={pad.left - 6}
              y={t.y + 3}
              textAnchor="end"
              className="fill-current text-[8px] opacity-50"
            >
              {t.revLabel}
            </text>
          </g>
        ))}

        {/* Bars + order dots */}
        {points.map((p, i) => {
          const xCenter = pad.left + groupW * i + groupW / 2;
          const barH    = innerH * (p.revenue / maxRevenue);
          const dotY    = pad.top + innerH - innerH * (p.orders / maxOrders);
          return (
            <g key={p.bucket}>
              {/* Revenue bar */}
              <rect
                x={xCenter - barW / 2}
                y={pad.top + innerH - barH}
                width={barW}
                height={barH}
                rx={2}
                fill="hsl(330 80% 75%)"
              />
              {/* Order count dot */}
              {p.orders > 0 && (
                <circle
                  cx={xCenter}
                  cy={dotY}
                  r={2.4}
                  fill="hsl(330 75% 40%)"
                />
              )}
              {/* Day label */}
              <text
                x={xCenter}
                y={H - 16}
                textAnchor={rotate ? "end" : "middle"}
                transform={
                  rotate ? `rotate(-50, ${xCenter}, ${H - 16})` : undefined
                }
                className="fill-current text-[8.5px] font-semibold opacity-70"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex items-center justify-end gap-4 text-[11px] text-fg-dark-soft">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "hsl(330 80% 75%)" }} />
          Revenue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "hsl(330 75% 40%)" }} />
          Order count
        </span>
      </div>
    </div>
  );
}
