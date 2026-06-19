"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { LocaleSwitcher } from "./LocaleSwitcher";

/** Hard-coded route paths — labels resolved per-locale via translations. */
const NAV = [
  { key: "home",     href: "/" },
  { key: "shop",     href: "/shop" },
  { key: "news",     href: "/news" },
  { key: "contact",  href: "/contact" },
  { key: "howToUse", href: "/how-to-use" },
  { key: "rules",    href: "/rules" },
] as const;

export function Navbar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <div className="anim-slide-down flex items-center justify-between gap-3 sm:gap-4">
          <Logo />

          <nav
            aria-label="Primary"
            className="glass flex items-center gap-2 rounded-full px-3.5 py-2.5 sm:gap-3 sm:px-5 sm:py-3 lg:flex-1"
          >
            {/* Desktop nav items */}
            <ul className="hidden items-center gap-1 lg:flex">
              {NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative inline-flex items-center rounded-full px-5 py-2.5 font-sans text-[14px] font-extrabold uppercase tracking-[0.1em]",
                        "transition-all duration-fast ease-spring hover:scale-105",
                        active
                          ? "tint-soft-strong text-pink-400"
                          : "tint-soft-hover text-fg-dark-soft hover:text-fg-dark",
                      )}
                    >
                      {t(item.key)}
                      {active && (
                        <span
                          aria-hidden
                          className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-pink-400"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center gap-2 lg:ml-auto">
              <LocaleSwitcher />
              <ThemeToggle />
              <button
                type="button"
                aria-label={open ? t("closeMenu") : t("openMenu")}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full",
                  "transition-all duration-fast ease-spring hover:scale-105",
                  open ? "bg-pink-500 text-white" : "tint-soft tint-soft-hover text-fg-dark",
                  "lg:hidden",
                )}
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </nav>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div className="anim-slide-down glass mt-3 overflow-hidden rounded-2xl lg:hidden">
            <ul className="divide-y divide-line-dark-2">
              {NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center justify-between gap-3 px-5 py-4 font-sans text-[14px] font-extrabold uppercase tracking-[0.1em]",
                        "transition-colors duration-fast",
                        active
                          ? "tint-soft text-pink-400"
                          : "tint-soft-hover text-fg-dark-soft hover:text-fg-dark",
                      )}
                    >
                      <span>{t(item.key)}</span>
                      <ChevronRight
                        size={16}
                        strokeWidth={2.25}
                        className={cn(
                          "transition-transform duration-fast",
                          active ? "text-pink-300" : "text-fg-dark-mute",
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Drawer footer: locale only — social links live on /contact now. */}
            <div className="tint-soft flex items-center justify-end gap-3 border-t border-line-dark-2 px-4 py-3">
              <LocaleSwitcher forceVisible />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
