"use client";

import { useTranslations } from "next-intl";
import { ImageOff } from "lucide-react";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import { Badge } from "@/components/ui/Badge";
import { formatTHB, formatUSD } from "@/lib/format";
import type { Product } from "@/types";
import { cn } from "@/lib/cn";

type Props = {
  product: Product;
  onSelect: (product: Product) => void;
};

/** Kawaii sticker card — lavender, chunky rounded, lift on hover. */
export function ProductCard({ product, onSelect }: Props) {
  const t = useTranslations("product");
  // `getActiveProducts` filters out products without plans, but a stale
  // server render or a manual ProductGrid caller could pass one through.
  // Render "—" instead of crashing the entire shop page.
  const lowest = product.plans[0];

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      disabled={product.comingSoon}
      className={cn(
        // h-full keeps every card in a grid row the same height, even
        // when one product's short description is 1 line and another's
        // is 2 — the body grows, the price row stays pinned to the
        // bottom via `mt-auto`.
        "group/card relative flex h-full w-full flex-col overflow-hidden text-left",
        "sticker rounded-lg sm:rounded-xl",
        "transition-all duration-base ease-spring",
        "hover:-translate-y-1.5",
        "disabled:opacity-55 disabled:hover:translate-y-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300",
      )}
    >
      <div className="relative aspect-[5/3] w-full overflow-hidden bg-paper-2">
        {product.images.length > 0 ? (
          <ImageWithSkeleton
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-slow ease-spring group-hover/card:scale-110"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-fg-light-mute">
            <ImageOff size={32} strokeWidth={1.5} aria-hidden />
          </div>
        )}
        {product.badge && (
          <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
            <Badge tone={product.badge}>{product.badge}</Badge>
          </div>
        )}
        {product.comingSoon && (
          <div className="absolute inset-0 grid place-items-center bg-black/55 font-sans text-[13px] font-extrabold uppercase tracking-[0.18em] text-white sm:text-[18px]">
            {t("comingSoon")}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-4">
        <h2 className="line-clamp-1 font-display text-[18px] tracking-wide text-fg-light sm:text-[22px]">
          {product.name}
        </h2>
        {/* Admin-authored short blurb takes priority — falls back to
            the plain description so legacy products without a short
            description still render something. */}
        <p className="line-clamp-2 text-[12px] leading-snug text-fg-light-soft sm:text-[13px]">
          {product.shortDescription || product.descriptionPlain}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2 sm:pt-3">
          <span className="hidden font-sans text-[11px] font-extrabold uppercase tracking-[0.12em] text-fg-light-mute sm:inline">
            {t("from")}
          </span>
          <span className="ml-auto whitespace-nowrap font-display text-[16px] text-pink-400 sm:text-[20px]">
            {lowest ? formatTHB(lowest.priceTHB) : "—"}
            {lowest && (
              <span className="hidden font-sans text-[12px] font-bold text-fg-light-mute sm:inline">
                {" "}/ {formatUSD(lowest.priceUSD)}
              </span>
            )}
          </span>
        </div>
      </div>
    </button>
  );
}
