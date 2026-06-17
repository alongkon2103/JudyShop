"use client";

import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useToastList, type ToastKind } from "./ToastContext";
import { cn } from "@/lib/cn";

const STYLES: Record<ToastKind, { ring: string; iconBg: string; Icon: typeof Info }> = {
  success: {
    ring:   "border-[hsl(150_55%_45%/0.4)]",
    iconBg: "bg-[hsl(150_55%_45%/0.18)] text-[hsl(150_55%_38%)]",
    Icon:   CheckCircle2,
  },
  error: {
    ring:   "border-pink-500/40",
    iconBg: "bg-pink-500/18 text-pink-500",
    Icon:   AlertTriangle,
  },
  info: {
    ring:   "border-cyan-400/40",
    iconBg: "bg-cyan-400/18 text-cyan-500",
    Icon:   Info,
  },
};

export function Toaster() {
  const { toasts, dismiss } = useToastList();
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => {
        const s = STYLES[t.kind];
        const Icon = s.Icon;
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "anim-slide-in-right pointer-events-auto flex items-start gap-3 rounded-md border bg-paper p-3 text-fg-light shadow-lg",
              s.ring,
            )}
          >
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md", s.iconBg)}>
              <Icon size={14} strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              {t.title && (
                <p className="font-sans text-[12px] font-extrabold uppercase tracking-[0.1em] text-fg-light">
                  {t.title}
                </p>
              )}
              <p className="text-[13px] text-fg-light-soft">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-light-mute transition-colors hover:bg-paper-2 hover:text-fg-light"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
