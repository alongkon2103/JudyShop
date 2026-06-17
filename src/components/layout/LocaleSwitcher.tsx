"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/routing";
import { routing, type SiteLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

/**
 * 2-button locale toggle (TH / EN). Uses next-intl's locale-aware router
 * so /shop → /en/shop without losing query params, and the default locale
 * stays prefix-free per our `localePrefix: "as-needed"` config.
 */
export function LocaleSwitcher({ forceVisible = false }: { forceVisible?: boolean }) {
  const active = useLocale() as SiteLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: SiteLocale) => {
    if (next === active || pending) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <div
      className={cn(
        "tint-soft items-center rounded-full p-1",
        forceVisible ? "flex" : "hidden sm:flex",
      )}
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => change(loc)}
          disabled={pending}
          aria-pressed={active === loc}
          className={cn(
            "rounded-full px-3 py-1.5 font-sans text-[12px] font-extrabold uppercase tracking-[0.1em] transition",
            active === loc ? "bg-pink-500 text-white" : "text-fg-dark-soft hover:text-fg-dark",
          )}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
