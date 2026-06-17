import { getTranslations, setRequestLocale } from "next-intl/server";
import { Compass } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";

/**
 * 404 page scoped under the `[locale]` segment.
 *
 * Locale comes from middleware via the `x-next-intl-locale` header
 * (set by next-intl). Falls back to the default locale if absent.
 */
export default async function NotFound() {
  const localeHeader = headers().get("x-next-intl-locale") ?? routing.defaultLocale;
  const locale = (routing.locales as readonly string[]).includes(localeHeader)
    ? localeHeader
    : routing.defaultLocale;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "notFound" });

  return (
    <section className="py-s5">
      <Container className="max-w-xl">
        <div className="sticker rounded-xl p-s5 text-center sm:p-s6">
          <span className="mx-auto mb-s3 grid h-16 w-16 place-items-center rounded-full bg-cyan-400/15 text-cyan-400">
            <Compass size={32} strokeWidth={2} />
          </span>
          <p className="font-mono text-[12px] font-bold uppercase tracking-[0.2em] text-fg-light-mute">
            404
          </p>
          <h1 className="mt-1 font-display text-[32px] uppercase tracking-wide text-fg-light sm:text-[40px]">
            {t("title")}
          </h1>
          <p className="mt-2 text-[14px] text-fg-light-soft sm:text-[15px]">
            {t("subtitle")}
          </p>

          <div className="mt-s5 flex flex-wrap items-center justify-center gap-2">
            <Button href="/">{t("home")}</Button>
            <Button href="/shop" variant="ghost">{t("shop")}</Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
