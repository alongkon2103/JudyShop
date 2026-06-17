"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark";
const STORAGE_KEY = "judyshop_theme";

/** Sun/moon toggle. Initial theme is set by the inline script in layout.tsx,
 *  so on mount we just sync state with the current attribute. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme | null) ?? "dark";
    setTheme(current);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      aria-pressed={theme === "light"}
      className={cn(
        "tint-soft tint-soft-hover grid h-10 w-10 place-items-center rounded-full text-fg-dark transition-all duration-fast ease-spring",
        "hover:scale-110",
        className,
      )}
    >
      {/* Reserve space so SSR shows something neutral before mount. */}
      {mounted ? (
        theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />
      ) : (
        <Sun size={16} strokeWidth={2} className="opacity-0" />
      )}
    </button>
  );
}
