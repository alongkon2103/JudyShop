import { defineRouting } from "next-intl/routing";
import { createSharedPathnamesNavigation } from "next-intl/navigation";

/**
 * Site routing config — single source of truth for both the middleware
 * and the typed `<Link>` / `usePathname` / `useRouter` exports.
 *
 * - Default locale "en" stays prefix-free   → `/`, `/shop`
 * - Thai uses an explicit prefix             → `/th`, `/th/shop`
 * - localeDetection: false → every first-time visitor lands on EN
 *   regardless of their browser's Accept-Language header (a deliberate
 *   product choice — international audience first, Thai users can
 *   toggle via the language switcher; the choice is persisted in
 *   the NEXT_LOCALE cookie).
 * - Admin & API routes are excluded by the middleware matcher.
 */
export const routing = defineRouting({
  locales: ["en", "th"] as const,
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeDetection: false,
});

export type SiteLocale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter } =
  createSharedPathnamesNavigation(routing);
