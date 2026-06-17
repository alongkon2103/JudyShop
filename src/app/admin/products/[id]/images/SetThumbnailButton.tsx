"use client";

import { useTransition } from "react";
import { Star } from "lucide-react";
import { useToast } from "@/components/admin/toast/ToastContext";
import { setImageThumbnail } from "../_actions";

export function SetThumbnailButton({
  productId,
  imageId,
}: {
  productId: string;
  imageId: string;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const onClick = () =>
    startTransition(async () => {
      try {
        await setImageThumbnail(productId, imageId);
        toast.success("Thumbnail updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label="Set as thumbnail"
      className="grid h-8 w-8 place-items-center rounded-md border border-line-light text-fg-light-soft transition-colors hover:bg-pink-500/10 hover:text-pink-500 disabled:opacity-50"
    >
      <Star size={14} strokeWidth={2.25} />
    </button>
  );
}
