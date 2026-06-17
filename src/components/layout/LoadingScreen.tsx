"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "judyshop_loader_seen";
const VISIBLE_MS = 1100;
const FADE_MS = 380;

/** Kawaii loader — JUDY SHOP wordmark with neon glow + progress bar. */
export function LoadingScreen() {
  const [phase, setPhase] = useState<"hidden" | "visible" | "fading">("hidden");

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    setPhase("visible");
    const t1 = window.setTimeout(() => setPhase("fading"), VISIBLE_MS);
    const t2 = window.setTimeout(() => {
      setPhase("hidden");
      sessionStorage.setItem(STORAGE_KEY, "1");
    }, VISIBLE_MS + FADE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] grid place-items-center bg-bg-1000"
      style={{
        opacity: phase === "fading" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
    >
      <div className="flex flex-col items-center gap-6">
        <h1 className="anim-pop font-display text-5xl tracking-wide sm:text-6xl">
          <span className="neon-text text-pink-400">JUDY</span>{" "}
          <span className="neon-text text-cyan-400">SHOP</span>
        </h1>
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="anim-progress h-full w-full rounded-full bg-pink-500" />
        </div>
      </div>
    </div>
  );
}
