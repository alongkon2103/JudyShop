import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, XCircle, Clock, Search, Hourglass } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { db } from "@/lib/db";
import {
  findUserWhitelistEntries,
  type UserWhitelistEntry,
} from "@/lib/whitelist";
import { clientIp, hit } from "@/lib/rate-limit";
import { pickI18n, type Locale } from "@/lib/locale";
import { cn } from "@/lib/cn";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "check" });
  return { title: t("title"), description: t("subtitle") };
}

// Always fresh so a fresh purchase reflects immediately.
export const dynamic = "force-dynamic";

// Rate-limit anonymous lookups so no one can enumerate the whitelist by
// firing thousands of usernames through the search field.
const IP_LIMIT     = 20;
const IP_WINDOW_MS = 60_000;

type SearchParams = { username?: string; product?: string };

export default async function CheckPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: SearchParams;
}) {
  setRequestLocale(params.locale);
  const locale = params.locale as Locale;
  const t = await getTranslations({ locale: params.locale, namespace: "check" });

  const username = (searchParams.username ?? "").trim();
  const productSlug = (searchParams.product ?? "").trim();

  // Product dropdown — only active products that the public can use.
  const products = await db.product.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { nameEn: "asc" }],
    select: { id: true, slug: true, nameEn: true, nameTh: true },
  });

  // Run the check only when the form has been submitted.
  let lookup: Awaited<ReturnType<typeof findUserWhitelistEntries>> | null = null;
  let limited = false;

  if (username) {
    const ip = clientIp(headers());
    const check = hit(`check-ui:ip:${ip}`, { limit: IP_LIMIT, windowMs: IP_WINDOW_MS });
    if (!check.ok) {
      limited = true;
    } else {
      lookup = await findUserWhitelistEntries(username, {
        productSlug: productSlug || undefined,
      });
    }
  }

  return (
    <section className="py-s5 sm:py-s6">
      <Container className="max-w-2xl">
        <header className="anim-fade-up mb-s5 text-center">
          <h1 className="font-display text-[36px] uppercase tracking-wide text-fg-dark sm:text-[48px]">
            {t("title")}
          </h1>
          <p className="mt-2 text-[14px] text-fg-dark-soft sm:text-[15px]">
            {t("subtitle")}
          </p>
        </header>

        {/* Lookup form — GET so the search is shareable / refreshable. */}
        <form
          method="get"
          action=""
          className="sticker rounded-xl p-s4 sm:p-s5"
        >
          <div className="grid grid-cols-1 gap-s3 sm:grid-cols-[2fr_1fr]">
            <label className="block">
              <span className="mb-1 block font-sans text-[11px] font-extrabold uppercase tracking-[0.16em] text-fg-light-soft">
                {t("usernameLabel")}
              </span>
              <input
                type="text"
                name="username"
                defaultValue={username}
                placeholder={t("usernamePlaceholder")}
                autoComplete="off"
                maxLength={100}
                required
                className={cn(
                  "w-full rounded-md border-2 border-line-light bg-paper-2 px-4 py-2.5 text-fg-light placeholder:text-fg-light-mute",
                  "transition-colors duration-fast focus:border-pink-400 focus:outline-none focus:ring-4 focus:ring-pink-400/20",
                )}
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-sans text-[11px] font-extrabold uppercase tracking-[0.16em] text-fg-light-soft">
                {t("productLabel")}
              </span>
              <select
                name="product"
                defaultValue={productSlug}
                className={cn(
                  "w-full rounded-md border-2 border-line-light bg-paper-2 px-4 py-2.5 text-fg-light",
                  "transition-colors duration-fast focus:border-pink-400 focus:outline-none focus:ring-4 focus:ring-pink-400/20",
                )}
              >
                <option value="">{t("anyProduct")}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {pickI18n(p.nameEn, p.nameTh, locale)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-s3 flex justify-end">
            <button
              type="submit"
              className={cn(
                "inline-flex items-center gap-2 rounded-full bg-pink-500 px-6 py-2.5 font-sans text-[13px] font-extrabold uppercase tracking-[0.12em] text-white",
                "transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5",
                "shadow-[0_3px_0_var(--pink-600),0_10px_28px_-8px_hsl(330_80%_50%/0.45)]",
              )}
            >
              <Search size={14} strokeWidth={2.5} />
              {t("submit")}
            </button>
          </div>
        </form>

        {/* Result panel */}
        <div className="mt-s4">
          {limited ? (
            <ResultBanner tone="warn" icon={<Hourglass size={28} strokeWidth={2} />}>
              <p className="font-display text-[20px] text-fg-light">{t("tooMany")}</p>
            </ResultBanner>
          ) : !username ? (
            <p className="rounded-md border border-line-light bg-paper-2/40 px-4 py-3 text-center text-[12px] text-fg-light-soft">
              {t("needUsername")}
            </p>
          ) : (
            <Result lookup={lookup!} locale={locale} t={t} />
          )}
        </div>
      </Container>
    </section>
  );
}

// ── Result rendering ──────────────────────────────────────────

function Result({
  lookup,
  locale,
  t,
}: {
  lookup: Awaited<ReturnType<typeof findUserWhitelistEntries>>;
  locale: Locale;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  // No matches at all — distinct from "the user has expired entries":
  // a username with zero rows is "not_found", while one with only
  // expired rows still shows up below as "Expired".
  if (lookup.entries.length === 0) {
    return (
      <ResultBanner tone="muted" icon={<XCircle size={28} strokeWidth={2} />}>
        <p className="font-display text-[20px] text-fg-light">{t("resultNotFound")}</p>
        <p className="mt-2 text-[13px] text-fg-light-soft">{t("notFoundHint")}</p>
      </ResultBanner>
    );
  }

  const activeCount = lookup.entries.filter((e) => e.status === "active").length;
  const expiredCount = lookup.entries.length - activeCount;

  return (
    <div className="space-y-s3">
      {/* Header — username + per-status counts. Makes it obvious at a
          glance that the user can have access in multiple games. */}
      <div className="sticker rounded-xl p-s3 sm:p-s4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-[18px] text-fg-light">
            <span className="font-mono text-fg-light">{lookup.username}</span>
          </p>
          <p className="text-[12px] text-fg-light-soft">
            {lookup.entries.length === 1
              ? t("multipleHeadingSingle")
              : t("multipleHeading", { n: lookup.entries.length })}
          </p>
        </div>
        {/* Status chips */}
        <div className="mt-2 flex flex-wrap gap-2">
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(150_55%_45%/0.18)] px-3 py-1 text-[11px] font-semibold text-[hsl(150_55%_38%)]">
              <CheckCircle2 size={12} strokeWidth={2.5} />
              {t("activeCount", { n: activeCount })}
            </span>
          )}
          {expiredCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(28_85%_55%/0.18)] px-3 py-1 text-[11px] font-semibold text-[hsl(28_85%_42%)]">
              <Clock size={12} strokeWidth={2.5} />
              {t("expiredCount", { n: expiredCount })}
            </span>
          )}
        </div>
      </div>

      {/* One card per product/entry. */}
      {lookup.entries.map((entry) => (
        <EntryCard
          key={entry.product.id}
          entry={entry}
          locale={locale}
          t={t}
        />
      ))}
    </div>
  );
}

function EntryCard({
  entry,
  locale,
  t,
}: {
  entry: UserWhitelistEntry;
  locale: Locale;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const isActive = entry.status === "active";
  const days = daysUntil(entry.expiresAt);
  const productName = pickI18n(entry.product.nameEn, entry.product.nameTh, locale);

  return (
    <ResultBanner
      tone={isActive ? "ok" : "warn"}
      icon={
        isActive ? (
          <CheckCircle2 size={28} strokeWidth={2} />
        ) : (
          <Clock size={28} strokeWidth={2} />
        )
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-[20px] text-fg-light">{productName}</p>
        <span
          className={cn(
            "font-sans text-[11px] font-extrabold uppercase tracking-[0.14em]",
            isActive ? "text-[hsl(150_55%_38%)]" : "text-[hsl(28_85%_42%)]",
          )}
        >
          {isActive ? t("resultActive") : t("resultExpired")}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        {entry.lifetime ? (
          <>
            <dt className="text-fg-light-mute">{t("validUntil")}</dt>
            <dd className="font-semibold text-pink-500">{t("lifetime")}</dd>
          </>
        ) : entry.expiresAt ? (
          <>
            <dt className="text-fg-light-mute">{t("validUntil")}</dt>
            <dd className="font-semibold text-fg-light">
              {new Date(entry.expiresAt).toLocaleDateString(
                locale === "th" ? "th-TH-u-ca-gregory" : "en-GB",
                { day: "2-digit", month: "long", year: "numeric" },
              )}
              {typeof days === "number" && (
                <span
                  className={cn(
                    "ml-2 text-[11px] font-semibold",
                    days < 0
                      ? "text-[hsl(0_70%_50%)]"
                      : days <= 7
                        ? "text-[hsl(28_85%_42%)]"
                        : "text-fg-light-mute",
                  )}
                >
                  {days < 0
                    ? `(${t("expiredAgo", { n: -days })})`
                    : `(${t("daysLeft", { n: days })})`}
                </span>
              )}
            </dd>
          </>
        ) : null}
      </dl>
    </ResultBanner>
  );
}

function ResultBanner({
  tone,
  icon,
  children,
}: {
  tone: "ok" | "warn" | "muted";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones = {
    ok:    "bg-[hsl(150_55%_45%/0.12)] text-[hsl(150_55%_38%)]",
    warn:  "bg-[hsl(28_85%_55%/0.14)] text-[hsl(28_85%_42%)]",
    muted: "bg-paper-2 text-fg-light-mute",
  } as const;
  return (
    <div className="sticker rounded-xl p-s4 sm:p-s5">
      <div className="flex items-start gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", tones[tone])}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
