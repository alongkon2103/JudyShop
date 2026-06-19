"use client";

import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Timer } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatTHB, formatUSD } from "@/lib/format";
import { priceBreakdown } from "@/lib/settings";
import type { PaymentMethod, Product } from "@/types";
import { cn } from "@/lib/cn";
import { ImageCarousel } from "./ImageCarousel";
import { PlanRow } from "./PlanRow";
import { PaymentMethodCard } from "./PaymentMethodCard";
import { RobloxPreview } from "./RobloxPreview";
import { startCheckout } from "@/lib/actions/checkout";
import { startTrialAction, type StartTrialErrorCode } from "@/lib/actions/trial";

/** Map server-action error codes to the right i18n message. */
function trialErrorMessage(
  code: StartTrialErrorCode,
  retryAfterSec: number | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  switch (code) {
    case "ip_rate_limited":    return t("trialErrIpRateLimited", { seconds: retryAfterSec ?? 30 });
    case "invalid_username":   return t("trialErrInvalidUsername");
    case "product_not_found":  return t("trialErrProductNotFound");
    case "product_inactive":   return t("trialErrProductInactive");
    case "trial_disabled":     return t("trialErrTrialDisabled");
    case "rate_limited":       return t("trialErrRateLimited");
    case "already_active":     return t("trialErrAlreadyActive");
    case "invalid_request":
    case "generic":
    default:                   return t("trialErrGeneric");
  }
}

type Props = {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  /** Card surcharge percentage from site settings. */
  cardFeePercent: number;
};

/** Kawaii product modal — chunky lavender card with sticker pills inside. */
export function ProductModal({ product, open, onClose, cardFeePercent }: Props) {
  const t = useTranslations("product");
  const titleId = useId();
  const [planId, setPlanId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("promptpay");
  const [username, setUsername] = useState("");
  const [shake, setShake] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [trialPending, startTrialTransition] = useTransition();
  const [trialMessage, setTrialMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  // Result of the Roblox username lookup that powers <RobloxPreview>.
  // `found` is false until the API confirms — we block the Pay button
  // only when we have a definitive miss (network errors don't count, to
  // avoid stranding users when Roblox is down).
  const [robloxFound, setRobloxFound] = useState(false);
  const onRobloxResolved = useCallback(
    (s: { found: boolean }) => setRobloxFound(s.found),
    [],
  );

  useEffect(() => {
    if (product) {
      setPlanId(product.plans[0]?.id ?? null);
      setMethod("promptpay");
      setUsername("");
      setShake(false);
      setCheckoutError(null);
      setTrialMessage(null);
      setRobloxFound(false);
    }
  }, [product]);

  const selectedPlan = useMemo(
    () => product?.plans.find((p) => p.id === planId) ?? null,
    [product, planId],
  );

  const breakdown = useMemo(
    () => priceBreakdown(selectedPlan?.priceTHB ?? 0, method, cardFeePercent),
    [selectedPlan, method, cardFeePercent],
  );

  // USD total mirrors the THB fee multiplier so the displayed amounts
  // stay in sync — card +6% must add 6% to BOTH currencies, otherwise
  // "฿1,590 / $50" looks suspicious and undersells the upcharge.
  const usdTotal = useMemo(() => {
    if (!selectedPlan) return 0;
    const base = Number(selectedPlan.priceUSD);
    if (method === "card" && cardFeePercent > 0) {
      return Math.round(base * (100 + cardFeePercent)) / 100;
    }
    return base;
  }, [selectedPlan, method, cardFeePercent]);

  if (!product) return null;

  const canPay = selectedPlan !== null && username.trim().length > 0;

  const handleTrial = () => {
    const u = username.trim();
    if (!u) {
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
      setTrialMessage({ tone: "err", text: t("enterUsernameFirst") });
      return;
    }
    setTrialMessage(null);
    startTrialTransition(async () => {
      try {
        const res = await startTrialAction({ productId: product.id, username: u });
        if (res.ok) {
          setTrialMessage({
            tone: "ok",
            text: t("trialOpened", {
              minutes: res.minutes,
              time: new Date(res.expiresAt).toLocaleTimeString(),
            }),
          });
        } else {
          setTrialMessage({ tone: "err", text: trialErrorMessage(res.code, res.retryAfterSec, t) });
        }
      } catch {
        setTrialMessage({ tone: "err", text: t("trialErrGeneric") });
      }
    });
  };

  const handlePay = () => {
    if (!canPay || !selectedPlan) {
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
      return;
    }
    setCheckoutError(null);
    startTransition(async () => {
      try {
        const res = await startCheckout({
          productId: product.id,
          planId:    selectedPlan.id,
          username:  username.trim(),
          method,
        });
        if (res.ok) {
          window.location.assign(res.url); // hand off to Stripe
        } else {
          setCheckoutError(res.error);
        }
      } catch (e) {
        console.error("[checkout]", e);
        setCheckoutError(e instanceof Error ? e.message : "Network error");
      }
    });
  };

  const hasCardFee = breakdown.fee > 0;

  return (
    <Modal open={open} onClose={onClose} size="lg" labelledBy={titleId}>
      <div className="relative">
        <ImageCarousel
          key={product.id}
          images={product.images}
          alt={product.name}
          aspectClass="aspect-[4/2]"
        />
        {product.badge && (
          <div className="absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
            <Badge tone={product.badge}>{product.badge}</Badge>
          </div>
        )}
      </div>

      <div className="space-y-5 px-5 pb-7 pt-4 sm:space-y-6 sm:px-7 sm:pb-8 sm:pt-5">
        <header>
          <h2
            id={titleId}
            className="font-display text-[20px] uppercase tracking-wide text-fg-light sm:text-[26px]"
          >
            {product.name}
          </h2>
          {/* Description is admin-authored HTML (TipTap → DOMPurify in
              the server action). Safe to render directly. */}
          <div
            className="prose-judy mt-2"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        </header>

        <div className="space-y-2.5">
          {product.plans.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              selected={planId === plan.id}
              onSelect={setPlanId}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PaymentMethodCard method="promptpay" selected={method === "promptpay"} onSelect={setMethod} cardFeePercent={cardFeePercent} />
          <PaymentMethodCard method="card"      selected={method === "card"}      onSelect={setMethod} cardFeePercent={cardFeePercent} />
        </div>

        <div className={cn("space-y-2", shake && "anim-shake")}>
          <label className="font-sans text-[12px] font-extrabold uppercase tracking-[0.12em] text-fg-light">
            {t("robloxUsername")}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("robloxUsernamePlaceholder")}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={cn(
              "w-full rounded-full border-2 border-line-light bg-paper-2 px-5 py-3 text-fg-light placeholder:text-fg-light-mute",
              "transition-all duration-fast ease-out focus:outline-none",
              "focus:border-pink-400 focus:ring-4 focus:ring-pink-400/25",
            )}
          />

          {/* <RobloxPreview username={username} onResolved={onRobloxResolved} />
          <p className="text-[12px] leading-snug text-fg-light-soft">{t("robloxUsernameHint")}</p> */}

        </div>

        {/* Price breakdown */}
        <div className="space-y-1 rounded-2xl border-2 border-line-light bg-paper-2 px-5 py-3 sm:px-6">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="font-sans font-semibold text-fg-light-soft">{t("subtotal")}</span>
            <span className="font-sans font-semibold text-fg-light">
              {formatTHB(breakdown.subtotal)}
            </span>
          </div>
          {hasCardFee && (
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-sans font-semibold text-fg-light-soft">
                {t("cardFee", { pct: breakdown.feePercent })}
              </span>
              <span className="font-sans font-semibold text-fg-light">
                +{formatTHB(breakdown.fee)}
              </span>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between border-t border-line-light pt-2">
            <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.12em] text-fg-light sm:text-[13px]">
              {t("total")}
            </span>
            <span className="font-display text-[22px] text-pink-400 sm:text-[28px]">
              {formatTHB(breakdown.total)}
              {selectedPlan && (
                <span className="ml-1 font-sans text-[12px] font-bold text-fg-light-mute sm:text-[14px]">
                  / {formatUSD(usdTotal)}
                </span>
              )}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePay}
          disabled={pending}
          className={cn(
            "w-full rounded-full px-6 py-4 font-sans text-[15px] font-extrabold uppercase tracking-[0.12em] text-white sm:text-[17px]",
            "bg-pink-500",
            "shadow-[0_3px_0_var(--pink-600),0_10px_28px_-8px_hsl(330_80%_50%/0.45)]",
            "transition-all duration-fast ease-spring hover:-translate-y-0.5 hover:bg-pink-400 active:translate-y-0.5",
            (!canPay || pending) && "opacity-75",
          )}
        >
          {pending ? t("redirecting") : t("payNow")}
        </button>
        {checkoutError && (
          <p className="rounded-md border border-pink-500/40 bg-pink-500/10 px-3 py-2 text-center text-[12px] font-bold text-pink-500">
            {checkoutError}
          </p>
        )}
        {!canPay && !checkoutError && (
          <p className="text-center text-[12px] text-fg-light-soft">{t("selectFirst")}</p>
        )}

        {product.trialEnabled && (
          <div className="space-y-2">
            {/* Visual separator so trial isn't mistaken for an alternate
                payment option — it's a different action entirely. */}
            <div className="flex items-center gap-2 pt-1">
              <span className="h-px flex-1 bg-line-light" aria-hidden />
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-fg-light-mute">
                {t("or")}
              </span>
              <span className="h-px flex-1 bg-line-light" aria-hidden />
            </div>

            <button
              type="button"
              onClick={handleTrial}
              disabled={trialPending || pending}
              className={cn(
                "group flex w-full items-center justify-center gap-2.5 rounded-full border-2 border-dashed border-pink-400/60 bg-paper-2 px-6 py-3 font-sans text-[13px] font-extrabold uppercase tracking-[0.1em] text-pink-500",
                "transition-all duration-fast ease-spring hover:-translate-y-0.5 hover:border-solid hover:border-pink-400 hover:bg-pink-500/10 active:translate-y-0.5",
                (trialPending || pending) && "opacity-60",
              )}
            >
              <Timer size={14} strokeWidth={2.5} className="transition-transform group-hover:rotate-12" />
              <span>
                {trialPending
                  ? t("tryingTrial")
                  : t("tryFreeMinutes", { minutes: product.trialMinutes ?? 10 })}
              </span>
              {!trialPending && (
                <span className="rounded-full bg-pink-500 px-2 py-0.5 font-mono text-[9px] font-bold text-white">
                  {t("freeBadge")}
                </span>
              )}
            </button>

            <ul className="space-y-0.5 text-[11px] text-fg-light-soft">
              <li className="flex items-start gap-1.5">
                <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-pink-400" aria-hidden />
                <span>{t("trialBullet1")}</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-pink-400" aria-hidden />
                <span>
                  {t("trialBullet2Prefix")}{" "}
                  <b className="text-fg-light">{t("trialBullet2Bold")}</b>
                </span>
              </li>
            </ul>

            {trialMessage && (
              <p
                className={cn(
                  "rounded-md px-3 py-2 text-center text-[12px] font-bold",
                  trialMessage.tone === "ok"
                    ? "border border-[hsl(150_55%_45%/0.4)] bg-[hsl(150_55%_45%/0.12)] text-[hsl(150_55%_35%)]"
                    : "border border-pink-500/40 bg-pink-500/10 text-pink-500",
                )}
              >
                {trialMessage.text}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
