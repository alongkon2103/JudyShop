"use client";

import { useState } from "react";
import type { TrendPoint } from "@/lib/finance";
import { formatTHB } from "@/lib/format";

type Props = {
  points: TrendPoint[];
};

const W = 560;
const H = 200;
const pad = { top: 18, right: 12, bottom: 28, left: 44 };
const innerW = W - pad.left - pad.right;
const innerH = H - pad.top - pad.bottom;

const GROSS_FILL = "hsl(330 80% 75%)";
const PAYOUT_FILL = "hsl(330 75% 45%)";
const POOL_FILL = "hsl(0 0% 65%)";

/**
 * Plain SVG grouped bar chart, no JS deps. Two bars per month —
 * Gross (light pink) and Partner Payout (deep pink) — so you eyeball
 * both volume + how much partners are taking each month.
 *
 * Hovering a month highlights its column and pops a styled tooltip with
 * the exact figures (mirrors the admin dashboard's RevenueAreaChart, and
 * gives the partner Finance page the same read-the-number-on-hover that
 * the plain static version was missing). Shared by both /admin/finance
 * and /partner/finance.
 */
export function TrendChart({ points }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!points.length) {
    return (
      <div className="grid h-40 place-items-center text-[12px] text-fg-light-mute">
        ยังไม่มีข้อมูล
      </div>
    );
  }

  const max = Math.max(1, ...points.map((p) => Math.max(p.gross, p.partnerPayout)));
  const groupW = innerW / points.length;
  const barW = Math.max(8, groupW * 0.35);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    y: pad.top + innerH * (1 - p),
    label: Math.round(max * p).toLocaleString(),
  }));

  const xCenter = (i: number) => pad.left + groupW * i + groupW / 2;

  // Map the pointer's horizontal position over the plot to the nearest
  // month group. The SVG keeps its aspect ratio (h-auto w-full), so a
  // viewBox→% mapping lines the tooltip up with the rendered bars.
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.floor((vbX - pad.left) / groupW);
    setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)));
  };

  const active = hoverIdx !== null ? points[hoverIdx]! : null;
  const anchor = active
    ? {
        leftPct: (xCenter(hoverIdx!) / W) * 100,
        topPct:
          ((pad.top + innerH - innerH * (Math.max(active.gross, active.partnerPayout) / max)) / H) *
          100,
      }
    : null;

  return (
    <div className="space-y-2">
      <div className="relative" onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>
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

          {/* Hovered column highlight */}
          {hoverIdx !== null && (
            <rect
              x={pad.left + groupW * hoverIdx}
              y={pad.top}
              width={groupW}
              height={innerH}
              fill="currentColor"
              opacity="0.05"
            />
          )}

          {/* Bars */}
          {points.map((p, i) => {
            const cx = xCenter(i);
            const grossH = innerH * (p.gross / max);
            const payoutH = innerH * (p.partnerPayout / max);
            return (
              <g key={p.monthKey}>
                {/* Gross bar (light pink) */}
                <rect
                  x={cx - barW - 1}
                  y={pad.top + innerH - grossH}
                  width={barW}
                  height={grossH}
                  rx={2}
                  fill={GROSS_FILL}
                />
                {/* Partner Payout bar (deep pink) */}
                <rect
                  x={cx + 1}
                  y={pad.top + innerH - payoutH}
                  width={barW}
                  height={payoutH}
                  rx={2}
                  fill={PAYOUT_FILL}
                />
                {/* Month label */}
                <text
                  x={cx}
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

        {/* Styled tooltip — anchored above the taller bar of the hovered month */}
        {active && anchor && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line-light bg-paper px-2.5 py-1.5 text-[11px] shadow-lg"
            style={{ left: `${anchor.leftPct}%`, top: `calc(${anchor.topPct}% - 8px)` }}
          >
            <p className="font-semibold text-fg-light">{active.label}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-fg-light-soft">
              <span aria-hidden className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: GROSS_FILL }} />
              <span>Gross</span>
              <span className="font-semibold text-fg-light tabular-nums">{formatTHB(active.gross)}</span>
            </p>
            <p className="flex items-center gap-1.5 text-fg-light-soft">
              <span aria-hidden className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: PAYOUT_FILL }} />
              <span>Partner Payout</span>
              <span className="font-semibold text-pink-500 tabular-nums">{formatTHB(active.partnerPayout)}</span>
            </p>
            {active.sharedPool > 0 && (
              <p className="flex items-center gap-1.5 text-fg-light-mute">
                <span aria-hidden className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: POOL_FILL }} />
                <span>เงินกลาง</span>
                <span className="tabular-nums">{formatTHB(active.sharedPool)}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-[11px] text-fg-dark-soft">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: GROSS_FILL }} />
          Gross
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PAYOUT_FILL }} />
          Partner Payout
        </span>
      </div>
    </div>
  );
}
