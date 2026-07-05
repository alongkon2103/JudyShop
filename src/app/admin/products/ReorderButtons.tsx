"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { reorderProduct } from "./_actions";

type Props = {
  id: string;
  /** Disable ▲ for the top row, ▼ for the bottom row. */
  isFirst: boolean;
  isLast: boolean;
};

/**
 * Stacked up/down arrows that move a product one slot in the catalogue.
 * Calls the `reorderProduct` server action inside a transition; the
 * action revalidates /admin/products so the reordered list streams back
 * in — router.refresh() is a belt-and-braces re-fetch of the RSC tree.
 */
export function ReorderButtons({ id, isFirst, isLast }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const move = (direction: "up" | "down") => {
    startTransition(async () => {
      await reorderProduct(id, direction);
      router.refresh();
    });
  };

  const btn =
    "grid h-6 w-6 place-items-center rounded-md border border-line-light text-fg-light-soft " +
    "hover:bg-paper-2 hover:text-fg-light disabled:pointer-events-none disabled:opacity-35";

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => move("up")}
        disabled={pending || isFirst}
        aria-label="Move up"
        title="เลื่อนขึ้น"
        className={btn}
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <ChevronUp size={14} strokeWidth={2.5} />}
      </button>
      <button
        type="button"
        onClick={() => move("down")}
        disabled={pending || isLast}
        aria-label="Move down"
        title="เลื่อนลง"
        className={btn}
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={14} strokeWidth={2.5} />}
      </button>
    </div>
  );
}
