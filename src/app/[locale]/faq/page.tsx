import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShoppingCart, User2, RefreshCw, Timer, LifeBuoy } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { SITE } from "@/constants/site";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "faq" });
  return { title: t("title"), description: t("subtitle") };
}

// Static — FAQ content changes via redeploy.
export const revalidate = 3600;

const SECTIONS = [
  {
    key: "buying",
    icon: ShoppingCart,
    items: ["howToBuy", "paymentMethods"] as const,
  },
  {
    key: "username",
    icon: User2,
    items: ["findUsername", "wrongUsername"] as const,
  },
  {
    key: "renewal",
    icon: RefreshCw,
    items: ["howToRenew", "checkExpiry"] as const,
  },
  {
    key: "trial",
    icon: Timer,
    items: ["trialHow", "trialLimit"] as const,
  },
  {
    key: "support",
    icon: LifeBuoy,
    items: ["support"] as const,
  },
] as const;

export default async function FaqPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "faq" });

  return (
    <section className="py-s5">
      <Container className="max-w-3xl">
        <header className="mb-s5 text-center">
          <h1 className="font-display text-[40px] uppercase tracking-wide text-fg-light sm:text-[56px]">
            {t("title")}
          </h1>
          <p className="mt-2 text-[14px] text-fg-light-soft sm:text-[16px]">
            {t("subtitle")}
          </p>
        </header>

        <div className="space-y-s5">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.key}>
                <h2 className="mb-s3 flex items-center gap-2 font-sans text-[12px] font-extrabold uppercase tracking-[0.14em] text-fg-light-soft">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-pink-500/15 text-pink-500">
                    <Icon size={14} strokeWidth={2.5} />
                  </span>
                  {t(`sections.${section.key}`)}
                </h2>

                <div className="space-y-2">
                  {section.items.map((itemKey) => (
                    // Native <details> — keyboard accessible, no JS needed,
                    // ships zero client-side bundle.
                    <details
                      key={itemKey}
                      className="group sticker overflow-hidden rounded-xl"
                    >
                      <summary className="flex cursor-pointer items-center justify-between gap-3 px-s4 py-s3 text-[14px] font-bold text-fg-light transition-colors hover:bg-paper-2/40 sm:text-[15px]">
                        <span>{t(`items.${itemKey}.q`)}</span>
                        <span
                          aria-hidden
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-paper-2 text-fg-light-soft transition-transform group-open:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <div className="border-t border-line-light bg-paper-2/30 px-s4 py-s3 text-[13px] leading-relaxed text-fg-light-soft sm:text-[14px]">
                        {t(`items.${itemKey}.a`)}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="sticker mt-s6 rounded-xl p-s4 text-center sm:p-s5">
          <h3 className="font-display text-[22px] uppercase tracking-wide text-fg-light sm:text-[28px]">
            {t("ctaTitle")}
          </h3>
          <p className="mt-1 text-[13px] text-fg-light-soft sm:text-[14px]">
            {t("ctaBody")}
          </p>
          <div className="mt-s4">
            <Button
              href={SITE.discordUrl}
              variant="discord"
              target="_blank"
              rel="noreferrer"
            >
              {t("ctaButton")}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
