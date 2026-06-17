export type PricingPlan = {
  id: string;
  label: string;
  durationLabel: string;
  priceTHB: number;
  priceUSD: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  shortName?: string;
  /** Rich HTML (TipTap output, server-sanitised). Render with
   *  dangerouslySetInnerHTML inside `.prose-judy`. */
  description: string;
  /** Plain-text version of `description` — use this for previews,
   *  line-clamp cards, meta descriptions, etc. */
  descriptionPlain: string;
  /** Short blurb authored separately from the rich description.
   *  Used as the product-card tagline; falls back to a truncated
   *  `descriptionPlain` if empty. */
  shortDescription?: string;
  /** Ordered gallery. images[0] is used as the card thumbnail. */
  images: string[];
  badge?: "hot" | "new" | "sale";
  plans: PricingPlan[];
  comingSoon?: boolean;
  /** True when "Try N minutes" is enabled. UI shows a trial CTA. */
  trialEnabled?: boolean;
  /** Trial length in minutes (only meaningful when trialEnabled). */
  trialMinutes?: number;
};

export type PaymentMethod = "promptpay" | "card";
