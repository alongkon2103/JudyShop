"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  labelledBy?: string;
};

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

const CLOSE_MS = 200;

/**
 * Kawaii modal — lavender sticker card on dark overlay,
 * chunky rounded corners, spring scale-in.
 */
export function Modal({
  open, onClose, children, className, size = "md", labelledBy,
}: ModalProps) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); return; }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => setMounted(false), CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div
      // Mobile: anchored to the bottom edge, full-width sheet.
      // Desktop (sm+): centred with breathing room around all sides.
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4 sm:py-8"
      role="dialog" aria-modal="true" aria-labelledby={labelledBy}
    >
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/72 backdrop-blur-sm transition-opacity"
        style={{ opacity: closing ? 0 : 1, transitionDuration: `${CLOSE_MS}ms` }}
      />
      <div
        data-closing={closing ? "true" : "false"}
        className={cn(
          "modal-sheet relative w-full overflow-hidden",
          // Top corners only on mobile (sheet hugs the bottom);
          // all corners on desktop (floating modal).
          "rounded-t-2xl sm:rounded-xl",
          "sticker text-fg-light",
          // svh handles iOS Safari's collapsing URL bar — fallback to
          // vh on older browsers. Slightly less than full so the user
          // can still see a hint of the page behind on mobile.
          "max-h-[92svh] overflow-y-auto scrollbar-themed",
          "anim-modal-in",
          sizes[size],
          className,
        )}
      >
        {/* Drag handle — purely visual indicator that this is a sheet
            (we don't actually support swipe-to-dismiss yet). Hidden on
            desktop where the modal is a centred dialog, not a sheet. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-white/40" aria-hidden />
        </div>

        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={cn(
            "absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center",
            "rounded-full bg-white text-violet-700 shadow-[0_2px_0_var(--paper-3),0_6px_14px_-4px_hsl(265_60%_20%/0.35)]",
            "transition-transform duration-fast ease-spring hover:scale-110",
            "sm:right-4 sm:top-4",
          )}
        >
          <X size={18} strokeWidth={2.25} />
        </button>
        {children}
      </div>
    </div>
  );
}
