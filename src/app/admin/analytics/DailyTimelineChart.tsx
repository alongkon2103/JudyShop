"use client";

import { useState } from "react";
import { formatTHB } from "@/lib/format";
import type { TimelinePoint } from "@/lib/analytics";

type Props = {
  points: TimelinePoint[];
};

const W = 720;
const H = 240;
const pad = { top: 18, right: 14, bottom: 38, left: 54 };

/**
 * SVG revenue bar chart — one bar per bucket (daily or monthly). Hovering
 * a bar highlights its column and shows a tooltip with the exact revenue
 * and order count for that bucket, so the admin never has to guess a
 * value off the axis.
 *
 * Revenue is the single visual series. (Order count used to be drawn as a
 * floating dot on a hidden second axis, which read as confusing — a busy,
 * low-value day put the dot *above* a tall revenue bar — so it now lives
 * in the tooltip only.)
 *
 * Labels rotate to vertical past ~14 buckets and are thinned so they never
 * overlap on long-history views.
 */
export function DailyTimelineChart({ points }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <p className="rounded-md border border-line-light bg-paper-2/40 px-3 py-6 text-center text-[12px] text-fg-light-soft">
        ไม่มีข้อมูลในช่วงที่เลือก
      </p>
    );
  }

  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const groupW = innerW / points.length;
  const barW = Math.max(3, Math.min(28, groupW * 0.7));

  const maxRevenue = Math.max(1, ...points.map((p) => p.revenue));
  const rotate     = points.length > 14;
  // Show at most ~14 x-labels so they don't collide on long ranges.
  const labelEvery = Math.ceil(points.length / 14);

  // Tick lines at 0%, 25%, 50%, 75%, 100% of revenue max.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    y: pad.top + innerH * (1 - p),
    revLabel: Math.round(maxRevenue * p).toLocaleString(),
  }));

  const xCenter = (i: number) => pad.left + groupW * i + groupW / 2;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xUser = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.floor((xUser - pad.left) / groupW);
    setHoverIdx(idx >= 0 && idx < points.length ? idx : null);
  };

  const active = hoverIdx != null ? points[hoverIdx]! : null;
  const activeBarTopFrac =
    active != null
      ? (pad.top + innerH - innerH * (active.revenue / maxRevenue)) / H
      : 0;
  // Flip the tooltip below the bar top when the bar is tall, so it never
  // clips off the top edge of the panel.
  const flip = activeBarTopFrac < 0.3;

  return (
    <div className="space-y-2">
      <div
        className="relative"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Revenue timeline"
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

          {/* Bars */}
          {points.map((p, i) => {
            const cx = xCenter(i);
            const barH = innerH * (p.revenue / maxRevenue);
            const isHover = i === hoverIdx;
            const showLabel = i % labelEvery === 0 || i === points.length - 1;
            return (
              <g key={p.bucket}>
                {/* Column highlight on hover */}
                {isHover && (
                  <rect
                    x={pad.left + groupW * i}
                    y={pad.top}
                    width={groupW}
                    height={innerH}
                    fill="hsl(330 80% 60%)"
                    opacity={0.1}
                  />
                )}
                {/* Revenue bar */}
                <rect
                  x={cx - barW / 2}
                  y={pad.top + innerH - barH}
                  width={barW}
                  height={barH}
                  rx={2}
                  fill={isHover ? "hsl(330 80% 60%)" : "hsl(330 80% 75%)"}
                />
                {/* Day / month label (thinned) */}
                {showLabel && (
                  <text
                    x={cx}
                    y={H - 16}
                    textAnchor={rotate ? "end" : "middle"}
                    transform={
                      rotate ? `rotate(-50, ${cx}, ${H - 16})` : undefined
                    }
                    className="fill-current text-[8.5px] font-semibold opacity-70"
                  >
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Styled tooltip — anchored to the hovered bar */}
        {active && hoverIdx != null && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-line-light bg-paper px-2.5 py-1.5 text-[11px] shadow-lg"
            style={{
              left: `${(xCenter(hoverIdx) / W) * 100}%`,
              top: `${activeBarTopFrac * 100}%`,
              transform: flip
                ? "translate(-50%, 8px)"
                : "translate(-50%, calc(-100% - 8px))",
            }}
          >
            <p className="font-semibold text-fg-light">{active.label}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-fg-light-soft">
              <span aria-hidden className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "hsl(330 80% 70%)" }} />
              <span className="font-semibold text-pink-500 tabular-nums">{formatTHB(active.revenue)}</span>
            </p>
            <p className="text-fg-light-mute tabular-nums">
              {active.orders} order{active.orders === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-4 text-[11px] text-fg-dark-soft">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "hsl(330 80% 75%)" }} />
          Revenue
        </span>
        <span className="text-fg-light-mute">ชี้เมาส์ที่แท่งเพื่อดูยอดและจำนวนออเดอร์</span>
      </div>
    </div>
  );
}
