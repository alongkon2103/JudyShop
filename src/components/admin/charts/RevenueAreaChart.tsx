"use client";

import { useState } from "react";
import { formatTHB } from "@/lib/format";

type Point = { date: string; revenue: number; orders: number };

type Props = {
  data: Point[];
  /** Number of date labels shown along x-axis. */
  xTicks?: number;
};

const W = 880;
const H = 240;
const PAD_L = 56;
const PAD_R = 18;
const PAD_T = 16;
const PAD_B = 28;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Lightweight SVG area chart — no external deps.
 * Renders revenue over time with a gradient fill + thin baseline grid.
 * A styled hover tooltip + guide line let the admin read the exact
 * revenue / order count for any day (replaces the old browser-native
 * <title> tooltip, which appeared after a delay and looked plain).
 */
export function RevenueAreaChart({ data, xTicks = 6 }: Props) {
  const [hover, setHover] = useState<{ idx: number; xPx: number; yPx: number } | null>(null);

  if (!data.length) return <Empty />;

  const max = Math.max(1, ...data.map((d) => d.revenue));
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const x = (i: number) =>
    PAD_L + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH;

  const linePath  = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)},${y(d.revenue)}`).join(" ");
  const areaPath  = `${linePath} L ${x(data.length - 1)},${PAD_T + innerH} L ${x(0)},${PAD_T + innerH} Z`;

  // y-axis ticks: 0, max/2, max
  const yTickVals = [0, max / 2, max];

  // x-axis ticks: evenly spaced indices (always include first & last)
  const tickIdx: number[] = [];
  const step = Math.max(1, Math.floor((data.length - 1) / (xTicks - 1)));
  for (let i = 0; i < data.length; i += step) tickIdx.push(i);
  if (tickIdx[tickIdx.length - 1] !== data.length - 1) tickIdx.push(data.length - 1);

  // Plot area as a fraction of the viewBox width — used to map a pixel
  // pointer position back to the nearest data index.
  const plotL = PAD_L / W;
  const plotR = (W - PAD_R) / W;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const t = (frac - plotL) / (plotR - plotL);
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(t * (data.length - 1))));
    setHover({
      idx,
      xPx: (x(idx) / W) * rect.width,
      yPx: (y(data[idx]!.revenue) / H) * rect.height,
    });
  };

  const active = hover ? data[hover.idx]! : null;

  return (
    <div
      className="relative"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Revenue trend"
        className="block h-auto w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgb(236 72 153)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(236 72 153)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal grid + y labels */}
        {yTickVals.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(v)}
              y2={y(v)}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeDasharray={v === 0 ? undefined : "3 3"}
            />
            <text
              x={PAD_L - 8}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-current text-[10px] opacity-60"
            >
              {compactTHB(v)}
            </text>
          </g>
        ))}

        {/* area + line */}
        <path d={areaPath} fill="url(#rev-grad)" />
        <path
          d={linePath}
          fill="none"
          stroke="rgb(236 72 153)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* hover guide line + highlighted point */}
        {hover && (
          <g>
            <line
              x1={x(hover.idx)}
              x2={x(hover.idx)}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke="rgb(236 72 153)"
              strokeOpacity="0.4"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(hover.idx)}
              cy={y(data[hover.idx]!.revenue)}
              r={4}
              fill="rgb(236 72 153)"
              stroke="white"
              strokeWidth="1.5"
            />
          </g>
        )}

        {/* end dot for emphasis (hidden while hovering to avoid double dot) */}
        {!hover && (
          <circle
            cx={x(data.length - 1)}
            cy={y(data[data.length - 1]!.revenue)}
            r={3.5}
            fill="rgb(236 72 153)"
            stroke="white"
            strokeWidth="1.5"
          />
        )}

        {/* x-axis labels */}
        {tickIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            className="fill-current text-[10px] opacity-60"
          >
            {shortDate(data[i]!.date)}
          </text>
        ))}
      </svg>

      {/* styled tooltip — follows the hovered point */}
      {hover && active && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line-light bg-paper px-2.5 py-1.5 text-[11px] shadow-lg"
          style={{
            left: `${hover.xPx}px`,
            top: `${Math.max(0, hover.yPx - 10)}px`,
          }}
        >
          <p className="font-semibold text-fg-light">{niceDate(active.date)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-fg-light-soft">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-pink-500" />
            <span className="font-semibold text-pink-500 tabular-nums">{formatTHB(active.revenue)}</span>
          </p>
          <p className="text-fg-light-mute tabular-nums">
            {active.orders} order{active.orders === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="grid h-40 place-items-center text-[12px] text-fg-dark-mute">
      ยังไม่มีข้อมูลในช่วงเวลานี้
    </div>
  );
}

function compactTHB(v: number): string {
  if (v >= 1_000_000) return `฿${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `฿${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return `฿${Math.round(v)}`;
}

function shortDate(iso: string): string {
  // "2026-06-08" → "Jun 8" — parse the parts directly so the label is
  // the exact calendar day in the key (no timezone re-interpretation).
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d ?? ""}`;
}

function niceDate(iso: string): string {
  // "2026-06-08" → "8 Jun 2026"
  const [y, m, d] = iso.split("-").map(Number);
  return `${d ?? ""} ${MONTHS[(m ?? 1) - 1]} ${y ?? ""}`;
}
