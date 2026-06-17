import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, Hourglass, Download, Gift, FileBox } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { fulfilCheckout } from "@/lib/checkout";
import { isCheckoutOwner } from "@/lib/checkout-cookie";
import { pickI18n, type Locale } from "@/lib/locale";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "success" });
  return { title: t("thankYou") };
}

export const dynamic = "force-dynamic";

function fmtTHB(amount: number) {
  return `฿${amount.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
}

function formatBytes(n: number | null | undefined) {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { session_id?: string };
}) {
  setRequestLocale(params.locale);
  const locale = params.locale as Locale;
  const t = await getTranslations({ locale: params.locale, namespace: "success" });

  const sessionId = searchParams.session_id;

  // Cookie set by `startCheckout` — proves *this browser* initiated
  // the checkout. Without it, /success is just a generic confirmation:
  // no order details, no premium downloads (which would otherwise leak
  // to anyone with the session_id link).
  const isOwner = isCheckoutOwner(sessionId);

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>> | null = null;
  if (sessionId && isOwner) {
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch {
      session = null;
    }
  }

  const orderInclude = {
    product: {
      include: {
        giftOverlays: { where: { isActive: true }, orderBy: { displayOrder: "asc" } },
        presets:      { where: { isActive: true }, orderBy: { displayOrder: "asc" } },
      },
    },
    plan:      { select: { labelEn: true, labelTh: true, isLifetime: true, durationDays: true } },
    whitelist: { select: { expireDate: true, isLifetime: true } },
  } as const;

  // Owner-only DB lookup. Strangers don't get to enumerate orders
  // by session id, so the rest of the page renders the generic
  // confirmation branch below.
  let order = isOwner && sessionId
    ? await db.order.findUnique({ where: { stripeSessionId: sessionId }, include: orderInclude })
    : null;

  // Fallback fulfilment (webhook hasn't fired yet). Only the owning
  // browser may trigger it — `fulfilCheckout` is idempotent, so this
  // is purely a UX optimisation for the buyer, not a security path.
  if (isOwner && !order && session?.payment_status === "paid") {
    try {
      const md = (session.metadata ?? {}) as Record<string, string | undefined>;
      const pm =
        session.payment_method_types?.includes("promptpay") ? "PROMPTPAY" : "CARD";
      const customerEmail =
        session.customer_details?.email ?? session.customer_email ?? null;
      await fulfilCheckout({
        stripeSessionId: session.id,
        stripePaymentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        metadata: { productId: md.productId, planId: md.planId, username: md.username },
        amountTotal: session.amount_total,
        currency:    session.currency,
        paymentMethod: pm,
        customerEmail,
      });
      order = await db.order.findUnique({
        where: { stripeSessionId: session.id },
        include: orderInclude,
      });
    } catch (err) {
      console.error("[/success] fallback fulfilment failed:", err);
    }
  }

  const product   = order?.product ?? null;
  const presets   = product?.presets      ?? [];
  const overlays  = product?.giftOverlays ?? [];

  const paid = session?.payment_status === "paid";
  const productName = product ? pickI18n(product.nameEn, product.nameTh, locale) : "";
  const planName    = order   ? pickI18n(order.plan.labelEn, order.plan.labelTh, locale) : "";

  // Header copy varies by viewer state. Stranger view comes first so
  // a leaked link can't trick the page into showing order details or
  // a misleading "your payment is processing" message.
  const headerTitle =
    !isOwner ? t("strangerTitle") : paid ? t("thankYou") : t("processing");
  const headerSubtitle =
    !isOwner ? t("strangerMessage") : paid ? t("paidMessage") : t("processingMessage");
  const headerIcon =
    !isOwner || !paid
      ? <Hourglass size={28} strokeWidth={2} />
      : <CheckCircle2 size={32} strokeWidth={2} />;

  return (
    <section className="py-s5">
      <Container className="max-w-3xl">
        <div className="sticker rounded-xl p-s5 text-center sm:p-s6">
          <span className="mx-auto mb-s3 grid h-16 w-16 place-items-center rounded-full bg-pink-500/15 text-pink-500">
            {headerIcon}
          </span>

          <h1 className="font-display text-[32px] uppercase tracking-wide text-fg-light sm:text-[40px]">
            {headerTitle}
          </h1>
          <p className="mt-2 text-[14px] text-fg-light-soft">
            {headerSubtitle}
          </p>

          {isOwner && order && (
            <dl className="mt-s4 grid grid-cols-2 gap-2 rounded-md border border-line-light bg-paper-2 p-s3 text-left text-[13px]">
              <dt className="text-fg-light-mute">{t("productLabel")}</dt>
              <dd className="font-semibold text-fg-light">{productName}</dd>

              <dt className="text-fg-light-mute">{t("planLabel")}</dt>
              <dd className="font-semibold text-fg-light">{planName}</dd>

              <dt className="text-fg-light-mute">{t("usernameLabel")}</dt>
              <dd className="font-mono text-fg-light">{order.username}</dd>

              <dt className="text-fg-light-mute">{t("paidLabel")}</dt>
              <dd className="font-semibold text-pink-500">
                {fmtTHB(Number(order.amount))}
              </dd>

              {order.whitelist && (
                <>
                  <dt className="text-fg-light-mute">{t("accessUntil")}</dt>
                  <dd className="font-semibold text-fg-light">
                    {order.whitelist.isLifetime
                      ? t("lifetimeBadge")
                      : order.whitelist.expireDate?.toLocaleString(
                          locale === "th" ? "th-TH" : "en-GB",
                          { day: "2-digit", month: "long", year: "numeric" },
                        ) ?? "—"}
                  </dd>
                </>
              )}
            </dl>
          )}

          {/* Payment cleared at Stripe but our fulfilment failed (missing
              metadata, plan deleted, DB outage, etc.). The user is on the
              hook for support but should NOT see download links yet.
              Owner-only — strangers never see the session_id here. */}
          {isOwner && !order && paid && (
            <div className="mt-s4 rounded-md border border-pink-500/40 bg-pink-500/5 p-s3 text-left text-[13px] text-fg-light">
              <p className="font-semibold">{t("processing")}</p>
              <p className="mt-1 text-fg-light-soft">{t("pendingWhitelist")}</p>
              {sessionId && (
                <p className="mt-2 font-mono text-[11px] text-fg-light-mute">
                  session: {sessionId}
                </p>
              )}
            </div>
          )}

          <div className="mt-s5 flex flex-wrap items-center justify-center gap-2">
            <Button href="/shop">{t("backToShop")}</Button>
            <Button href="/" variant="ghost">{t("home")}</Button>
          </div>
        </div>

        {/* Belt-and-braces: presets/overlays already come from `order`
            which is null for strangers, but pin the guard explicitly
            so a future refactor can't accidentally unlock downloads. */}
        {isOwner && (presets.length > 0 || overlays.length > 0) && (
          <section className="mt-s5 space-y-s4">
            {presets.length > 0 && (
              <DownloadList
                title={t("presetFiles")}
                downloadLabel={t("downloadBtn")}
                icon={<FileBox size={16} strokeWidth={2.25} />}
                items={presets.map((p) => ({
                  id: p.id,
                  title: pickI18n(p.nameEn, p.nameTh, locale),
                  subtitle: [p.targetProgram, p.version && `v${p.version}`].filter(Boolean).join(" · ") || undefined,
                  meta: `${p.fileName} · ${formatBytes(p.fileSize)}`,
                  url: p.fileUrl,
                  fileName: p.fileName,
                }))}
              />
            )}

            {overlays.length > 0 && (
              <GiftOverlayGallery
                title={t("giftOverlays")}
                hint={t("downloadHint")}
                saveLabel={t("saveBtn")}
                items={overlays.map((g) => ({
                  id: g.id,
                  name: pickI18n(g.giftNameEn, g.giftNameTh, locale),
                  imageUrl: g.imageUrl,
                }))}
              />
            )}
          </section>
        )}
      </Container>
    </section>
  );
}

// ── Components ──────────────────────────────────────────────

function DownloadList({
  title,
  icon,
  items,
  downloadLabel,
}: {
  title: string;
  icon: React.ReactNode;
  items: { id: string; title: string; subtitle?: string; meta?: string; url: string; fileName?: string }[];
  downloadLabel: string;
}) {
  return (
    <div className="sticker rounded-xl p-s4 sm:p-s5">
      <h2 className="mb-s3 flex items-center gap-2 text-[15px] font-semibold text-fg-light">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-pink-500/15 text-pink-500">
          {icon}
        </span>
        {title} ({items.length})
      </h2>
      <ul className="divide-y divide-line-light">
        {items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-3 py-s3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-fg-light">{it.title}</p>
              {it.subtitle && <p className="text-[12px] text-fg-light-soft">{it.subtitle}</p>}
              {it.meta && <p className="truncate font-mono text-[11px] text-fg-light-mute">{it.meta}</p>}
            </div>
            <a
              href={it.url}
              download={it.fileName}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-pink-500 px-4 font-sans text-[12px] font-semibold text-white shadow-[0_2px_0_var(--pink-600)] hover:bg-pink-400"
            >
              <Download size={12} strokeWidth={2.5} /> {downloadLabel}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GiftOverlayGallery({
  items,
  title,
  hint,
  saveLabel,
}: {
  items: { id: string; name: string; imageUrl: string }[];
  title: string;
  hint: string;
  saveLabel: string;
}) {
  return (
    <div className="sticker rounded-xl p-s4 sm:p-s5">
      <h2 className="mb-s3 flex items-center gap-2 text-[15px] font-semibold text-fg-light">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-pink-500/15 text-pink-500">
          <Gift size={16} strokeWidth={2.25} />
        </span>
        {title} ({items.length})
      </h2>
      <p className="mb-s3 text-[12px] text-fg-light-soft">{hint}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((g) => (
          <li
            key={g.id}
            className="flex flex-col overflow-hidden rounded-md border border-line-light bg-paper-2"
          >
            <a href={g.imageUrl} target="_blank" rel="noreferrer" className="block">
              <div className="relative aspect-square w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.imageUrl}
                  alt={g.name}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </div>
            </a>
            <div className="flex items-center gap-2 px-2 py-2">
              <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-fg-light">
                {g.name}
              </p>
              <a
                href={g.imageUrl}
                download={overlayFileName(g.name, g.imageUrl)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 items-center gap-1 rounded-full bg-pink-500 px-2.5 font-sans text-[11px] font-semibold text-white shadow-[0_2px_0_var(--pink-600)] hover:bg-pink-400"
                aria-label={`Download ${g.name}`}
              >
                <Download size={11} strokeWidth={2.5} />
                {saveLabel}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Clean filename for an overlay download: "Rose" + ".png" from the URL. */
function overlayFileName(name: string, url: string): string {
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "png";
  const safeExt = /^[a-z0-9]{2,5}$/i.test(ext) ? ext : "png";
  const slug = name.trim().replace(/[^a-z0-9ก-๙\-_ ]+/gi, "").replace(/\s+/g, "_") || "overlay";
  return `${slug}.${safeExt}`;
}
