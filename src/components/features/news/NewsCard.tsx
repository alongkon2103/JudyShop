import { useLocale, useTranslations } from "next-intl";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import { cn } from "@/lib/cn";
import type { NewsCategory, NewsItem } from "@/types";

/** Chip color per category. The label is resolved through translations. */
const CHIP: Record<NewsCategory, string> = {
  update:      "bg-pink-400 text-white",
  announce:    "bg-cyan-400 text-bg-1000",
  event:       "bg-violet-400 text-white",
  maintenance: "bg-[hsl(28_90%_60%)] text-white",
};

export function NewsCard({ item }: { item: NewsItem }) {
  const t = useTranslations("news.category");
  const locale = useLocale();

  // Date stamp respects the active locale.
  // TH year is the Buddhist era — keep en-GB Gregorian for both so the
  // figure isn't off by 543, but pull localized month abbreviations.
  const date = new Date(item.date);
  const dateLabel = date
    .toLocaleDateString(locale === "th" ? "th-TH-u-ca-gregory" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();

  return (
    <article
      className={cn(
        "sticker group/news flex flex-col gap-s2 rounded-md p-s4 sm:flex-row sm:gap-s4 sm:p-s5",
        "transition-transform duration-fast ease-spring hover:-translate-y-0.5",
      )}
    >
      {/* Date column — bold "stamp" */}
      <div className="flex shrink-0 items-center gap-s3 sm:w-32 sm:flex-col sm:items-start sm:gap-s2">
        <time
          dateTime={item.date}
          className="font-display text-[18px] leading-none text-fg-light sm:text-[22px]"
        >
          {dateLabel}
        </time>
        <span
          className={cn(
            "rounded-full px-3 py-1 font-sans text-[10px] font-extrabold uppercase tracking-[0.14em]",
            CHIP[item.category],
          )}
        >
          {t(item.category)}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 sm:border-l sm:border-line-light sm:pl-s4">
        <h2 className="font-display text-[20px] leading-tight text-fg-light sm:text-[24px]">
          {item.title}
        </h2>
        {item.imageUrl && (
          <div className="mt-s3 overflow-hidden rounded-md">
            <div className="relative aspect-[16/9] w-full bg-paper-2">
              <ImageWithSkeleton
                src={item.imageUrl}
                alt={item.title}
                fill
                sizes="(max-width: 640px) 100vw, 640px"
                className="object-cover"
              />
            </div>
          </div>
        )}
        <p className="mt-s2 text-[14px] leading-relaxed text-fg-light-soft sm:text-[15px]">
          {item.excerpt}
        </p>
      </div>
    </article>
  );
}
