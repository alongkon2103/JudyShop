"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./toast/ToastContext";

type Props = {
  /**
   * Server action invoked when the user confirms. MUST be a server-action
   * reference (use `myAction.bind(null, ...args)` to pre-fill args from a
   * server component). Plain arrow functions cannot cross the server↔client
   * boundary in Next.js — Next.js will throw "Event handlers cannot be
   * passed to Client Component props".
   */
  action: () => Promise<unknown>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** Toast shown on success. */
  successMessage?: string;
  /** Label on the button itself. Default: "Delete". */
  label?: React.ReactNode;
  /** Visual size of the trigger button. */
  size?: "sm" | "md";
  /** Override icon (default: trash). */
  icon?: React.ReactNode | null;
  className?: string;
};

/**
 * Destructive button that pops a confirm dialog and pipes the action
 * result through the global toast.
 */
export function DeleteButton({
  action,
  title = "Delete this item?",
  description = "This action cannot be undone.",
  confirmLabel = "Delete",
  successMessage = "Deleted.",
  label = "Delete",
  size = "sm",
  icon,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const sizeCls = size === "sm" ? "h-9 px-4 text-[11px]" : "h-10 px-5 text-[12px]";

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full border border-line-light font-sans font-extrabold uppercase tracking-[0.1em] text-pink-400",
          "transition-all duration-fast ease-spring hover:border-pink-500/40 hover:bg-pink-500/10 active:translate-y-px",
          "disabled:opacity-55",
          sizeCls,
          className,
        )}
      >
        {icon !== null && (icon ?? <Trash2 size={12} strokeWidth={2.5} />)}
        {label}
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        onConfirm={handleConfirm}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        variant="danger"
        pending={pending}
      />
    </>
  );
}
