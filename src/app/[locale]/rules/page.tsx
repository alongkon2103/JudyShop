import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScrollText } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/locale";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "rules" });
  return { title: t("title"), description: t("subtitle") };
}

export const dynamic = "force-dynamic";

export default async function RulesPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const locale = params.locale as Locale;
  const t = await getTranslations({ locale: params.locale, namespace: "rules" });

  const setting = await db.setting.findUnique({ where: { id: "singleton" } });
  const html =
    locale === "th"
      ? setting?.rulesContentTh ?? ""
      : setting?.rulesContentEn ?? "";

  return (
    <section className="py-s5 sm:py-s6">
      <Container className="max-w-3xl">
        <header className="anim-fade-up mb-s5 text-center">
          <h1 className="font-display text-[40px] uppercase tracking-wide text-fg-dark sm:text-[60px]">
            {t("title")}
          </h1>
          <p className="mt-2 font-sans text-[12px] font-extrabold uppercase tracking-[0.2em] text-fg-dark-soft sm:text-[13px]">
            {t("subtitle")}
          </p>
        </header>

        {html.trim().length === 0 ? (
          <div className="glass mx-auto max-w-md rounded-xl p-s5 text-center">
            <span aria-hidden className="mx-auto mb-s2 grid h-10 w-10 place-items-center rounded-full bg-pink-500/15 text-pink-400">
              <ScrollText size={20} strokeWidth={2} />
            </span>
            <p className="font-display text-[22px] text-fg-dark">{t("empty")}</p>
          </div>
        ) : (
          <article className="anim-fade-up sticker rounded-xl p-s5 sm:p-s6">
            {/* Same .prose-judy class as product descriptions — admin
                rules render with the matching typography + colour. */}
            <div
              className="prose-judy"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </article>
        )}
      </Container>
    </section>
  );
}
