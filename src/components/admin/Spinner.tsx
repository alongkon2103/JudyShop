import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, number> = { sm: 14, md: 18, lg: 28 };

/**
 * Minimal spinner used while server pages stream in. Pink to match the
 * primary accent. Inline-flex so it sits next to text naturally.
 */
export function Spinner({
  size = "md",
  className,
  label,
}: {
  size?: Size;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-pink-500", className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 size={SIZE[size]} strokeWidth={2.25} className="animate-spin" />
      {label && (
        <span className="text-[12px] font-semibold text-fg-light-soft">{label}</span>
      )}
      {!label && <span className="sr-only">Loading…</span>}
    </span>
  );
}

/**
 * Full-page centered spinner. Used inside route `loading.tsx` files when
 * we don't have enough info to render a skeleton that matches the real
 * layout (e.g. detail pages).
 */
export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-fg-light-soft">
        <Loader2 size={32} strokeWidth={2.25} className="animate-spin text-pink-500" />
        {label && <p className="text-[13px] font-semibold">{label}</p>}
      </div>
    </div>
  );
}
