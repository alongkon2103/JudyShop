import { cn } from "@/lib/cn";

type Tone = "ok" | "warn" | "muted" | "accent" | "info";

const tones: Record<Tone, string> = {
  ok:     "bg-[hsl(150_55%_45%/0.18)] text-[hsl(150_55%_38%)]",
  warn:   "bg-[hsl(28_85%_55%/0.18)] text-[hsl(28_85%_42%)]",
  muted:  "bg-paper-2 text-fg-light-mute",
  accent: "bg-pink-500/15 text-pink-500",
  info:   "bg-cyan-400/18 text-cyan-500",
};

export function StatusBadge({
  tone = "muted",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-sans text-[10px] font-extrabold uppercase tracking-[0.14em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
