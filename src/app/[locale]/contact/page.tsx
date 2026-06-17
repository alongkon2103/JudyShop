import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Mail } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SITE } from "@/constants/site";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "contact",
  });
  return { title: t("title"), description: t("subtitle") };
}

// Static — channels change via redeploy.
export const revalidate = 3600;

function DiscordIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M19.27 5.33A18.4 18.4 0 0 0 15.05 4l-.21.42a17 17 0 0 0-5.68 0L8.95 4a18.4 18.4 0 0 0-4.22 1.33C2.1 9.18 1.4 13 1.74 16.74A18.6 18.6 0 0 0 7.4 19.6l1-1.42a12 12 0 0 1-1.92-.94l.47-.34a13 13 0 0 0 11.1 0l.47.34c-.6.36-1.24.67-1.92.94l1 1.42a18.6 18.6 0 0 0 5.66-2.86c.42-4.3-.65-8.08-3.99-11.41ZM8.92 14.6c-1.12 0-2.04-1.04-2.04-2.32 0-1.28.9-2.32 2.04-2.32 1.13 0 2.05 1.04 2.04 2.32 0 1.28-.91 2.32-2.04 2.32Zm6.16 0c-1.12 0-2.04-1.04-2.04-2.32 0-1.28.9-2.32 2.04-2.32 1.13 0 2.05 1.04 2.04 2.32 0 1.28-.91 2.32-2.04 2.32Z" />
    </svg>
  );
}

function TikTokIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M19.5 8.5a6.5 6.5 0 0 1-4-1.36V15a5.5 5.5 0 1 1-5.5-5.5c.32 0 .63.03.94.08v2.74a2.8 2.8 0 1 0 1.96 2.68V3h2.6a4 4 0 0 0 4 4v1.5Z" />
    </svg>
  );
}

function YouTubeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.42-4.81ZM10 15V9l5.2 3-5.2 3Z" />
    </svg>
  );
}

type Channel = {
  key: "discord" | "tiktok" | "youtube" | "email";
  href: string;
  // Address shown under the channel name — host for URLs, address for mailto.
  displayHost: string;
  Icon: (props: { className?: string }) => JSX.Element;
  // Background colour for the icon chip.
  accent: string;
};

const CHANNELS: Channel[] = [
  {
    key: "discord",
    href: SITE.discordUrl,
    displayHost: "discord.gg/ERV8KqRztF",
    Icon: DiscordIcon,
    accent: "hsl(235 86% 67%)",
  },
  {
    key: "tiktok",
    href: SITE.tiktokUrl,
    displayHost: "tiktok.com/@judyshop_th",
    Icon: TikTokIcon,
    accent: "hsl(0 0% 8%)",
  },
  {
    key: "youtube",
    href: SITE.youtubeUrl,
    displayHost: "youtube.com/@JUDYSHOP-TH",
    Icon: YouTubeIcon,
    accent: "hsl(0 85% 50%)",
  },
  {
    key: "email",
    href: `mailto:${SITE.supportEmail}`,
    displayHost: SITE.supportEmail,
    Icon: ({ className = "" }) => <Mail className={className} strokeWidth={2.25} />,
    accent: "hsl(330 80% 58%)",
  },
];

export default async function ContactPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations({
    locale: params.locale,
    namespace: "contact",
  });

  return (
    <section className="py-s6">
      <Container className="max-w-2xl">
        <header className="mb-s6 text-center">
          <h1 className="font-display text-[40px] uppercase tracking-wide text-fg-light sm:text-[56px]">
            {t("title")}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-fg-light-soft sm:text-[16px]">
            {t("subtitle")}
          </p>
        </header>

        <ul className="space-y-s4">
          {CHANNELS.map(({ key, href, displayHost, Icon, accent }) => {
            const isMailto = href.startsWith("mailto:");
            return (
              <li key={key}>
                <a
                  href={href}
                  {...(isMailto ? {} : { target: "_blank", rel: "noreferrer" })}
                  className="sticker group relative flex items-center gap-s4 overflow-hidden rounded-2xl p-s4 transition-transform duration-fast ease-spring hover:-translate-y-1 sm:gap-s5 sm:p-s5"
                >
                  {/* Soft tinted glow from the brand colour — keeps cards
                      distinct without recolouring the whole panel. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-[0.12] blur-2xl transition-opacity duration-fast group-hover:opacity-[0.22]"
                    style={{ backgroundColor: accent }}
                  />

                  <span
                    className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-[0_3px_0_hsl(265_60%_15%/0.55)] transition-transform duration-fast ease-spring group-hover:scale-110 group-hover:rotate-6 sm:h-16 sm:w-16"
                    style={{ backgroundColor: accent }}
                  >
                    <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
                  </span>

                  <div className="relative min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <p className="font-display text-[20px] uppercase tracking-wide text-fg-light sm:text-[24px]">
                        {t(`${key}.label`)}
                      </p>
                      <p className="truncate text-[12px] font-semibold tracking-wide text-fg-light-mute sm:text-[13px]">
                        {displayHost}
                      </p>
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed text-fg-light-soft sm:text-[16px]">
                      {t(`${key}.detail`)}
                    </p>
                  </div>

                  <span
                    aria-hidden
                    className="relative hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-paper-2 text-fg-light-soft transition-all duration-fast ease-spring group-hover:bg-pink-500 group-hover:text-white sm:grid"
                  >
                    <span className="text-[18px] transition-transform duration-fast group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
