/**
 * i18n primitives — used wherever we need to render one of an EN/TH pair.
 *
 * Right now the public site doesn't have a locale prefix; everything
 * defaults to "th". When `next-intl` lands and we add `/th` / `/en`
 * route groups, only the call sites change (pages forward the locale
 * from params) — these helpers stay the same.
 */

export type Locale = "th" | "en";

export const LOCALES: Locale[] = ["en", "th"];
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Pick one of an EN/TH pair. Falls back to the other side if the
 * preferred field is empty (handles partially-filled rows gracefully).
 */
export function pickI18n(en: string | null | undefined, th: string | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  if (locale === "th") return th?.trim() || en?.trim() || "";
  return en?.trim() || th?.trim() || "";
}
