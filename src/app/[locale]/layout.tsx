import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing, type SiteLocale } from "@/i18n/routing";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

/** Build a static page for every supported locale at build time. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Public chrome — kawaii navbar + footer + theme-aware background,
 * scoped under the [locale] segment so all public pages share the
 * same next-intl provider and locale-aware navigation links.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as SiteLocale)) notFound();

  // Required for any static rendering under [locale] (next-intl 3.22+).
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {/* Theme-aware background image layer + darken overlay */}
      <div aria-hidden className="app-bg pointer-events-none fixed inset-0 z-0" />
      <div aria-hidden className="app-bg-overlay pointer-events-none fixed inset-0 z-0" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </NextIntlClientProvider>
  );
}
