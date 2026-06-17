import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Resolves the request locale + matching messages bundle for each server
 * render. next-intl calls this through the plugin we wired in
 * next.config.mjs — never invoke it directly from app code.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as (typeof routing.locales)[number])
    ? (requested as (typeof routing.locales)[number])
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
