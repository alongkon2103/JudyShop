"use client";

import { useTransition } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/components/admin/toast/ToastContext";
import { cn } from "@/lib/cn";

type Props = {
  /** Server action — must accept ("up" | "down") and be a bound action ref. */
  move: (direction: "up" | "down") => Promise<unknown>;
  canUp: boolean;
  canDown: boolean;
};

export function ReorderButtons({ move, canUp, canDown }: Props) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const onMove = (dir: "up" | "down") => () =>
    startTransition(async () => {
      try { await move(dir); } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-line-light">
      <Btn label="Move up" onClick={onMove("up")} disabled={!canUp || pending}>
        <ChevronUp size={14} strokeWidth={2.25} />
      </Btn>
      <span aria-hidden className="h-7 w-px self-center bg-line-light" />
      <Btn label="Move down" onClick={onMove("down")} disabled={!canDown || pending}>
        <ChevronDown size={14} strokeWidth={2.25} />
      </Btn>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "grid h-8 w-8 place-items-center text-fg-light-soft",
        "transition-colors hover:bg-paper-2 hover:text-fg-light",
        "disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-fg-light-soft",
      )}
    >
      {children}
    </button>
  );
}
