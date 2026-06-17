import type { TrendPoint } from "@/lib/finance";

type Props = {
  points: TrendPoint[];
};

/**
 * Plain SVG grouped bar chart, no JS deps. Two bars per month —
 * Gross (light pink) and Partner Payout (deep pink) — so the admin
 * eyeballs both volume + how much partners are taking each month.
 */
export function TrendChart({ points }: Props) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.gross, p.partnerPayout)));
  const W = 560;
  const H = 200;
  const pad = { top: 18, right: 12, bottom: 28, left: 44 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const groupW = innerW / points.length;
  const barW = Math.max(8, groupW * 0.35);

  // Tick lines at 0%, 25%, 50%, 75%, 100% of max.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    y: pad.top + innerH * (1 - p),
    label: Math.round(max * p).toLocaleString(),
  }));

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label="Revenue trend last 6 months"
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
              {t.label}
            </text>
          </g>
        ))}

        {/* Bars */}
        {points.map((p, i) => {
          const xCenter = pad.left + groupW * i + groupW / 2;
          const grossH  = innerH * (p.gross / max);
          const payoutH = innerH * (p.partnerPayout / max);
          return (
            <g key={p.monthKey}>
              {/* Gross bar (light pink) */}
              <rect
                x={xCenter - barW - 1}
                y={pad.top + innerH - grossH}
                width={barW}
                height={grossH}
                rx={2}
                fill="hsl(330 80% 75%)"
              />
              {/* Partner Payout bar (deep pink) */}
              <rect
                x={xCenter + 1}
                y={pad.top + innerH - payoutH}
                width={barW}
                height={payoutH}
                rx={2}
                fill="hsl(330 75% 45%)"
              />
              {/* Month label */}
              <text
                x={xCenter}
                y={H - 8}
                textAnchor="middle"
                className="fill-current text-[9px] font-semibold opacity-70"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-[11px] text-fg-dark-soft">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: "hsl(330 80% 75%)" }}
          />
          Gross
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: "hsl(330 75% 45%)" }}
          />
          Partner Payout
        </span>
      </div>
    </div>
  );
}
