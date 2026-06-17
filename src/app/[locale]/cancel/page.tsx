import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { XCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "cancel" });
  return { title: t("title") };
}

export default async function CancelPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "cancel" });
  const tNav = await getTranslations({ locale: params.locale, namespace: "nav" });

  return (
    <section className="grid min-h-[60svh] place-items-center py-s5">
      <Container>
        <div className="sticker mx-auto max-w-md rounded-xl p-s5 text-center sm:p-s6">
          <span className="mx-auto mb-s3 grid h-16 w-16 place-items-center rounded-full bg-fg-light-mute/15 text-fg-light-mute">
            <XCircle size={32} strokeWidth={2} />
          </span>
          <h1 className="font-display text-[28px] uppercase tracking-wide text-fg-light sm:text-[36px]">
            {t("title")}
          </h1>
          <p className="mt-2 text-[14px] text-fg-light-soft">{t("message")}</p>
          <div className="mt-s5 flex flex-wrap items-center justify-center gap-2">
            <Button href="/shop">{t("tryAgain")}</Button>
            <Button href="/" variant="ghost">{tNav("home")}</Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
