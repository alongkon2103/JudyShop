"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import { cn } from "@/lib/cn";

type Props = {
  images: string[];
  alt: string;
  aspectClass?: string;
  className?: string;
};

/** Kawaii carousel — rounded image, soft chunky arrows, dot pill. */
export function ImageCarousel({
  images,
  alt,
  aspectClass = "aspect-[4/3]",
  className,
}: Props) {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hasMany = images.length > 1;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth;
        if (w === 0) return;
        setIndex(Math.round(el.scrollLeft / w));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const goTo = (next: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = ((next % images.length) + images.length) % images.length;
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className={cn("group/carousel relative w-full", aspectClass, className)}>
      <div
        ref={scrollerRef}
        className={cn(
          "flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {images.map((src, i) => (
          <div key={i} className="relative h-full w-full shrink-0 snap-center bg-paper-2">
            <ImageWithSkeleton
              src={src}
              alt={`${alt} – ${i + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {hasMany && (
        <>
          {[
            { dir: "left",  Icon: ChevronLeft,  label: "Previous image", step: -1, pos: "left-2 sm:left-3" },
            { dir: "right", Icon: ChevronRight, label: "Next image",     step: +1, pos: "right-2 sm:right-3" },
          ].map(({ dir, Icon, label, step, pos }) => (
            <button
              key={dir}
              type="button"
              aria-label={label}
              onClick={() => goTo(index + step)}
              className={cn(
                "absolute top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full",
                "bg-white text-violet-700 shadow-[0_3px_0_var(--paper-3),0_8px_18px_-6px_hsl(265_50%_20%/0.45)]",
                "transition-transform duration-fast ease-spring hover:scale-110",
                "opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100",
                "max-sm:opacity-100",
                pos,
              )}
            >
              <Icon size={18} strokeWidth={2} />
            </button>
          ))}

          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-bg-1000/55 px-2.5 py-1.5 backdrop-blur-sm">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to image ${i + 1}`}
                aria-current={i === index}
                onClick={() => goTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-base ease-spring",
                  i === index ? "w-5 bg-white" : "w-1.5 bg-white/55 hover:bg-white/85",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
