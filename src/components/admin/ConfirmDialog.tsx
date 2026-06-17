"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Portal } from "./Portal";
import { cn } from "@/lib/cn";

type Variant = "danger" | "default";

const CLOSE_MS = 160;

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  pending?: boolean;
};

/**
 * Lightweight confirm dialog — used before destructive actions.
 * Backdrop fade + body spring scale-in; ESC closes; Enter confirms.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  pending = false,
}: Props) {
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
      if (e.key === "Enter" && !pending) void onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted, onClose, onConfirm, pending]);

  if (!mounted) return null;

  return (
    <Portal>
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => !pending && onClose()}
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px] transition-opacity"
        style={{ opacity: closing ? 0 : 1, transitionDuration: `${CLOSE_MS}ms` }}
      />

      <div
        className={cn(
          "anim-spring relative w-full max-w-sm rounded-lg",
          "panel shadow-2xl",
        )}
        style={{
          opacity: closing ? 0 : undefined,
          transform: closing ? "scale(0.94)" : undefined,
          transition: closing ? `opacity ${CLOSE_MS}ms ease, transform ${CLOSE_MS}ms ease` : undefined,
        }}
      >
        <button
          type="button"
          onClick={() => !pending && onClose()}
          aria-label="Close"
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded text-fg-light-mute hover:bg-paper-2 hover:text-fg-light"
        >
          <X size={14} strokeWidth={2.5} />
        </button>

        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            {variant === "danger" && (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-pink-500/15 text-pink-500">
                <AlertTriangle size={16} strokeWidth={2.25} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2
                id="confirm-title"
                className="font-sans text-[15px] font-extrabold text-fg-light"
              >
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-[13px] leading-relaxed text-fg-light-soft">
                  {description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="h-9 rounded-md border border-line-light px-4 font-sans text-[11px] font-extrabold uppercase tracking-[0.12em] text-fg-light-soft transition-colors hover:bg-paper-2 hover:text-fg-light disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={pending}
              className={cn(
                "h-9 rounded-md px-5 font-sans text-[11px] font-extrabold uppercase tracking-[0.12em] text-white",
                "transition-colors disabled:opacity-60",
                variant === "danger"
                  ? "bg-pink-500 hover:bg-pink-600"
                  : "bg-fg-light hover:bg-fg-light-soft",
              )}
            >
              {pending ? "Working…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
}
