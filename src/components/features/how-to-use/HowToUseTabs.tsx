"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { youtubeEmbedUrl } from "@/lib/youtube";

type Video = {
  id: string;
  videoId: string;
  title: string;
  description: string;
};

/**
 * Card-style tab selector for how-to-use videos.
 *
 * Layout: a horizontal scrollable row of cards (one per video) at the
 * top, click to select. The selected video's embed + description show
 * below. With a single video, the tab row is hidden so the page reads
 * as a plain article.
 */
export function HowToUseTabs({
  videos,
  selectLabel,
}: {
  videos: Video[];
  selectLabel: string;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = videos[activeIdx] ?? videos[0];
  if (!active) return null;

  return (
    <div className="space-y-s4">
      {videos.length > 1 && (
        <>
          <p className="px-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-fg-dark-soft">
            {selectLabel}
          </p>
          {/* Horizontal scroller on mobile; wraps on desktop. */}
          <div className="flex gap-2 overflow-x-auto pb-1.5 sm:flex-wrap sm:overflow-x-visible">
            {videos.map((v, i) => {
              const isActive = i === activeIdx;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  aria-pressed={isActive}
                  className={cn(
                    "sticker shrink-0 rounded-md px-3 py-2 text-left transition-all duration-fast ease-spring sm:w-auto sm:max-w-[220px]",
                    isActive
                      ? "border-pink-400 ring-1 ring-pink-400/30"
                      : "hover:-translate-y-0.5",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded",
                        isActive ? "bg-pink-500 text-white" : "bg-pink-500/15 text-pink-500",
                      )}
                    >
                      <PlayCircle size={11} strokeWidth={2.25} />
                    </span>
                    <p className="min-w-0 truncate text-[12px] font-semibold text-fg-light">
                      {v.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Player + description */}
      <div className="sticker overflow-hidden rounded-xl">
        <div className="aspect-video w-full bg-black">
          <iframe
            key={active.videoId}
            src={youtubeEmbedUrl(active.videoId)}
            title={active.title}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full border-0"
          />
        </div>
        {(active.title || active.description) && (
          <div className="space-y-s2 p-s4 sm:p-s5">
            <h2 className="font-display text-[20px] text-fg-light sm:text-[24px]">
              {active.title}
            </h2>
            {active.description && (
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-fg-light-soft sm:text-[15px]">
                {active.description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
