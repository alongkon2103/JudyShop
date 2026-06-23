import { useTranslations } from "next-intl";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SITE } from "@/constants/site";

/**
 * Kawaii hero — chunky JUDY SHOP wordmark with neon glow,
 * tagline, paired CTAs, mascot below.
 */
export function Hero() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  return (
    <section className="relative flex min-h-[85svh] items-center py-s5 sm:py-s6">
      <Container className="w-full">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <h1 className="anim-pop whitespace-nowrap font-hero text-[56px] leading-none tracking-wide sm:text-[88px] lg:text-[112px]">
            <span className="neon-text text-pink-400">JUDY</span>{" "}
            <span className="neon-text text-cyan-400">SHOP</span>
          </h1>

          <p className="anim-fade-up anim-delay-300 mt-s4 max-w-xl text-balance text-[17px] leading-relaxed text-fg-dark-soft sm:text-[19px]">
            {t("heroSubtitle")}
          </p>

          <div className="anim-fade-up anim-delay-500 mt-s5 flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button href="/shop" size="lg">{t("ctaShop")}</Button>
              <Button
                href={SITE.discordUrl}
                variant="discord"
                size="lg"
                target="_blank"
                rel="noreferrer"
              >
                {tCommon("joinDiscord")}
              </Button>
            </div>
            <Button
              href={SITE.tikfinityUrl}
              variant="secondary"
              size="lg"
              target="_blank"
              rel="noreferrer"
            >
              {t("ctaTikfinity")}
            </Button>
          </div>
        </div>

        {/* Mascot — centered mobile, bottom-left on desktop */}
        {/* <div className="relative mt-s5 flex justify-center sm:mt-s6 sm:block sm:h-40">
          <div className="anim-fade-up anim-delay-700 sm:absolute sm:bottom-0 sm:left-0">
            <MascotPodium />
          </div>
        </div> */}
      </Container>
    </section>
  );
}

function MascotPodium() {
  return (
    <div className="group relative flex flex-col items-center">
      <div className="anim-floating transition-transform duration-base ease-spring group-hover:-translate-y-1 group-hover:rotate-[-4deg]">
        <div className="anim-breathing">
          <div className="relative h-28 w-28 overflow-hidden rounded-full ring-4 ring-violet-300/35 shadow-[0_8px_30px_-8px_hsl(265_70%_30%/0.6)] sm:h-36 sm:w-36">
            <ImageWithSkeleton
              src="https://dummyimage.com/500x500/2a1450/ffffff&text=%20MASCOT"
              alt="Judy mascot"
              fill
              sizes="(max-width: 640px) 112px, 144px"
              // Mascot is above the fold on every viewport and becomes
              // the LCP element on locales whose Announcement row has
              // no imageUrl (otherwise the announcement image is LCP
              // and gets its own <link rel="preload">). Marking it
              // priority disables lazy-loading and lets the browser
              // start the fetch during HTML parsing.
              priority
              className="object-cover transition-transform duration-slow ease-spring group-hover:scale-110"
            />
          </div>
        </div>
      </div>
      <div className="mt-3 h-3 w-32 rounded-full bg-violet-400/50 blur-[3px] sm:w-40" />
    </div>
  );
}
