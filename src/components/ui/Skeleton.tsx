import { cn } from "@/lib/cn";

/**
 * Block-level skeleton loader. Pass sizing classes via `className`
 * (e.g. `h-4 w-32 rounded-full`).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton-shimmer", className)} />;
}
