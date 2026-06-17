"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  id: string;
  message: string | null;
  imageUrl: string | null;
  /** ISO datetime — currently unused; reserved for future per-update dismiss. */
  updatedAt: string;
};

/**
 * Site-wide promo popup shown on the Home page.
 *
 * Behaviour:
 *  - Opens automatically on mount (no localStorage memory — every visit
 *    re-shows so devs/admins can preview without clearing storage).
 *  - User closes with the X button or by clicking the backdrop.
 *  - Layout adapts: image-only, message-only, or both.
 */
export function AnnouncementPopup({ message, imageUrl }: Props) {
  const t = useTranslations("common");
  // Open immediately on mount so the popup is in the initial HTML — combined
  // with the home page's <link rel="preload"> this lets the image paint as
  // soon as the page is hydrated (good LCP). The slide-down animation still
  // gives the "intentional appearance" feel.
  const [open, setOpen] = useState(true);

  if (!open || (!message && !imageUrl)) return null;

  const close = () => setOpen(false);
  // Image-only popups can be a bit wider to showcase a full poster.
  const wide = imageUrl && !message;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-start justify-center px-3 pb-6 pt-[max(16px,env(safe-area-inset-top))] sm:items-center sm:pt-4"
    >
      <button
        type="button"
        aria-label={t("close")}
        onClick={close}
        className="anim-fade-in absolute inset-0 bg-bg-1000/60 backdrop-blur-[2px]"
      />

      <div
        className={cn(
          "anim-slide-down relative w-full overflow-hidden rounded-2xl",
          "bg-paper text-fg-light shadow-2xl ring-1 ring-line-light",
          wide ? "max-w-lg" : "max-w-md",
        )}
      >
        {imageUrl && (
          <div className="relative w-full bg-paper-2">
            {/* Plain <img> so we don't need to allowlist remote hosts. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              // Popup is auto-opened on every visit and is typically the LCP
              // element. Tell the browser to prioritise this resource and
              // load it eagerly so it doesn't get queued behind other assets.
              fetchPriority="high"
              decoding="async"
              className="block h-auto w-full object-contain"
            />
          </div>
        )}

        {message && (
          <div className="space-y-3 p-5 sm:p-6">
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-fg-light">
              {message}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={close}
          aria-label={t("close")}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-paper/85 text-fg-light shadow-md ring-1 ring-black/10 transition-colors hover:bg-white"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
