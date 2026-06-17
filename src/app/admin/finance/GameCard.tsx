import type { GameBreakdown } from "@/lib/finance";
import { fmtTHB } from "@/lib/finance";

type Props = {
  game: GameBreakdown;
  /** Total gross across all games this month — used to compute the % share. */
  totalMonthGross: number;
};

/**
 * One card per product, expanded by default. Header shows the
 * headline numbers (gross, orders, avg, % of month) and the table
 * underneath lists every partner row + the synthetic "เงินกลาง" line
 * at the bottom (rendered with a muted style so it reads as a
 * different kind of recipient).
 */
export function GameCard({ game, totalMonthGross }: Props) {
  const pctOfMonth = totalMonthGross > 0 ? (game.gross / totalMonthGross) * 100 : 0;

  return (
    <div className="panel space-y-3 rounded-xl p-4 sm:p-5">
      {/* Header */}
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-light pb-3">
        <h3 className="font-display text-[20px] tracking-wide text-fg-light">
          {game.name}
        </h3>
        <span className="font-display text-[22px] text-pink-500">
          {fmtTHB(game.gross)}
        </span>
      </header>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Stat label="Orders" value={game.orderCount.toLocaleString()} />
        <Stat label="Avg / order" value={fmtTHB(game.avgPerOrder)} />
        <Stat label="Of month" value={`${pctOfMonth.toFixed(1)}%`} />
      </div>

      {/* Lines table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead className="border-b border-line-light text-[10px] uppercase tracking-[0.06em] text-fg-light-mute">
            <tr>
              <th className="px-2 py-1.5 font-semibold">Recipient</th>
              <th className="px-2 py-1.5 font-semibold">Contact</th>
              <th className="px-2 py-1.5 text-right font-semibold">Share</th>
              <th className="px-2 py-1.5 text-right font-semibold">Payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-light">
            {game.lines.map((line, i) => {
              const isPool = line.partnerId === null;
              return (
                <tr key={i} className={isPool ? "bg-paper-2/40" : ""}>
                  <td className="px-2 py-1.5">
                    <span
                      className={
                        isPool
                          ? "font-semibold text-fg-light-soft"
                          : "font-semibold text-fg-light"
                      }
                    >
                      {isPool ? "— เงินกลาง —" : line.name}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-fg-light-soft">
                    {line.contact ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-fg-light-soft">
                    {line.sharePercent.toFixed(2)}%
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-fg-light">
                    {fmtTHB(line.payout)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line-light bg-paper-2/40 px-2 py-1.5">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-fg-light-mute">
        {label}
      </p>
      <p className="text-[13px] font-bold text-fg-light">{value}</p>
    </div>
  );
}
