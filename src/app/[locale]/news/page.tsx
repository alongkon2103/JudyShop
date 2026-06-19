import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { NewsCard } from "@/components/features/news/NewsCard";
import { getPublishedNews } from "@/lib/news";
import type { Locale } from "@/lib/locale";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "news" });
  return { title: t("title"), description: t("subtitle") };
}

export const dynamic = "force-dynamic";

export default async function NewsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "news" });

  const items = await getPublishedNews(params.locale as Locale);

  return (
    <section className="py-s5 sm:py-s6">
      <Container>
        <header className="anim-fade-up mx-auto mb-s5 max-w-2xl text-center">
          <h1 className="font-display text-[40px] uppercase tracking-wide text-fg-dark sm:text-[60px]">
            {t("title")}
          </h1>
          <p className="mt-2 font-sans text-[12px] font-extrabold uppercase tracking-[0.2em] text-fg-dark-soft sm:text-[13px]">
            {t("subtitle")}
          </p>
        </header>

        {items.length === 0 ? (
          <div className="glass mx-auto max-w-md rounded-xl p-s5 text-center">
            <p className="font-display text-[22px] text-fg-dark">{t("empty")}</p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-s3 sm:gap-s4">
            {items.map((item, i) => (
              <div
                key={item.id}
                className="anim-fade-up"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <NewsCard
                  item={{
                    id: item.id,
                    category: item.category,
                    date: item.publishedAt,
                    title: item.title,
                    excerpt: item.excerpt,
                    imageUrl: item.imageUrl,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
