import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PlayCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { HowToUseTabs } from "@/components/features/how-to-use/HowToUseTabs";
import { db } from "@/lib/db";
import { pickI18n, type Locale } from "@/lib/locale";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "howToUse" });
  return { title: t("title"), description: t("subtitle") };
}

export const dynamic = "force-dynamic";

export default async function HowToUsePage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const locale = params.locale as Locale;
  const t = await getTranslations({ locale: params.locale, namespace: "howToUse" });

  const rows = await db.howToUseVideo.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  const videos = rows.map((v) => ({
    id: v.id,
    videoId: v.videoId,
    title: pickI18n(v.titleEn, v.titleTh, locale),
    description: pickI18n(v.descriptionEn ?? "", v.descriptionTh ?? "", locale),
  }));

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

        {videos.length === 0 ? (
          <div className="glass mx-auto max-w-md rounded-xl p-s5 text-center">
            <span aria-hidden className="mx-auto mb-s2 grid h-10 w-10 place-items-center rounded-full bg-pink-500/15 text-pink-400">
              <PlayCircle size={20} strokeWidth={2} />
            </span>
            <p className="font-display text-[22px] text-fg-dark">{t("empty")}</p>
          </div>
        ) : (
          <div className="anim-fade-up mx-auto max-w-3xl">
            <HowToUseTabs videos={videos} selectLabel={t("selectLabel")} />
          </div>
        )}
      </Container>
    </section>
  );
}
