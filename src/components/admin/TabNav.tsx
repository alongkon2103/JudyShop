"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type Tab = {
  href: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
};

export function TabNav({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <nav
      role="tablist"
      className="panel -mx-1 flex gap-1 overflow-x-auto rounded-full p-1"
    >
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold",
              "transition-colors duration-fast",
              active
                ? "bg-pink-500 text-white"
                : "text-fg-light-soft hover:bg-paper-2 hover:text-fg-light",
            )}
          >
            {t.icon}
            <span>{t.label}</span>
            {typeof t.count === "number" && (
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                  active ? "bg-white/22 text-white" : "bg-paper-2 text-fg-light-mute",
                )}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
