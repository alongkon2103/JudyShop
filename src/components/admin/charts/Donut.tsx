type Segment = { label: string; value: number; color: string };

type Props = {
  segments: Segment[];
  /** Big number rendered in the center hole. Default = total. */
  centerLabel?: string;
  centerSub?:   string;
  size?: number;
};

/**
 * SVG donut chart with center label and a side legend.
 * Segments with value 0 are silently skipped.
 */
export function Donut({ segments, centerLabel, centerSub, size = 168 }: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const radius     = size / 2;
  const inner      = radius * 0.62;
  const strokeW    = radius - inner;
  const ringRadius = (radius + inner) / 2; // path radius (center of stroke)
  const c          = 2 * Math.PI * ringRadius;

  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="block h-full w-full -rotate-90">
          {/* track */}
          <circle
            cx={radius}
            cy={radius}
            r={ringRadius}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth={strokeW}
          />
          {total > 0 &&
            segments.map((seg, i) => {
              if (seg.value <= 0) return null;
              const frac = seg.value / total;
              const len  = c * frac;
              const dasharray = `${len} ${c - len}`;
              const el = (
                <circle
                  key={i}
                  cx={radius}
                  cy={radius}
                  r={ringRadius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeW}
                  strokeDasharray={dasharray}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-display text-[26px] leading-none text-fg-dark">
              {centerLabel ?? total.toLocaleString()}
            </div>
            {centerSub && (
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-dark-mute">
                {centerSub}
              </div>
            )}
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5 text-[12px]">
        {segments.map((seg, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: seg.color }}
              aria-hidden
            />
            <span className="text-fg-dark-soft">{seg.label}</span>
            <span className="ml-auto pl-2 font-medium tabular-nums text-fg-dark">
              {seg.value.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
