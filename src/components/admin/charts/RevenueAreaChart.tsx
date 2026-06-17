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

/**
 * Lightweight SVG area chart — no external deps.
 * Renders revenue over time with a gradient fill + thin baseline grid.
 */
export function RevenueAreaChart({ data, xTicks = 6 }: Props) {
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

  return (
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

      {/* end dot for emphasis */}
      <circle
        cx={x(data.length - 1)}
        cy={y(data[data.length - 1]!.revenue)}
        r={3.5}
        fill="rgb(236 72 153)"
        stroke="white"
        strokeWidth="1.5"
      />

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

      {/* tooltips — invisible hit rects */}
      {data.map((d, i) => {
        const cx = x(i);
        const cy = y(d.revenue);
        const half = innerW / Math.max(1, data.length - 1) / 2;
        return (
          <g key={i} className="group">
            <rect
              x={cx - half}
              y={PAD_T}
              width={half * 2}
              height={innerH}
              fill="transparent"
            />
            <circle
              cx={cx}
              cy={cy}
              r={3}
              className="fill-pink-500 opacity-0 transition-opacity group-hover:opacity-100"
            />
            <title>{`${d.date} · ${formatTHB(d.revenue)} · ${d.orders} order${d.orders === 1 ? "" : "s"}`}</title>
          </g>
        );
      })}
    </svg>
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
  // "2026-06-08" → "Jun 8"
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
