import { cn } from "@/lib/cn";

/**
 * Generic shimmer skeleton block. Use as a placeholder for any chunk
 * of UI that's still being fetched. Pure CSS — no JS animation cost.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "skeleton-shimmer rounded-md bg-paper-2",
        className,
      )}
    />
  );
}

/**
 * Table skeleton — header + N rows of shimmer cells.
 * Drop-in for admin list pages while the server query resolves.
 */
export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="panel overflow-hidden rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
          <thead className="border-b border-line-light bg-paper-2/40">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-2.5">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-light">
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: columns }).map((_, c) => (
                  <td key={c} className="px-4 py-3">
                    <Skeleton className={c === 0 ? "h-4 w-32" : "h-3 w-24"} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Vertical stack of card-shaped skeletons — for product detail tabs
 * where the body is a single panel rather than a table.
 */
export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="panel space-y-3 rounded-xl p-4 sm:p-5">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
      <Skeleton className="h-9 w-32 mt-2" />
    </div>
  );
}

/** Quick KPI tile skeleton for the dashboard. */
export function StatTileSkeleton() {
  return (
    <li className="panel rounded-md p-s3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-7 w-7 rounded-md" />
      </div>
      <Skeleton className="mt-3 h-7 w-24" />
      <Skeleton className="mt-2 h-2 w-12" />
    </li>
  );
}
