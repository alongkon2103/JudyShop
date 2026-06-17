import { cn } from "@/lib/cn";

type Tone = "hot" | "new" | "sale" | "muted";

/** Kawaii pill chip — chunky display label, soft tint, no border. */
const tones: Record<Tone, string> = {
  hot:   "bg-[hsl(20_90%_58%)] text-white shadow-[0_2px_0_hsl(20_80%_40%),0_8px_18px_-6px_hsl(20_90%_50%/0.55)]",
  new:   "bg-cyan-400 text-bg-1000 shadow-[0_2px_0_hsl(195_75%_38%),0_8px_18px_-6px_hsl(195_85%_50%/0.55)]",
  sale:  "bg-pink-500 text-white shadow-[0_2px_0_var(--pink-600),0_8px_18px_-6px_hsl(330_80%_50%/0.55)]",
  muted: "bg-bg-800 text-fg-dark-soft border border-line-dark",
};

export function Badge({
  tone = "hot",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 font-sans text-[11px] font-extrabold uppercase tracking-[0.1em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
