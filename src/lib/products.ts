/**
 * Public Product fetchers.
 *
 * Reads from Postgres via Prisma and normalises the DB shape into
 * the (i18n-aware) `Product` type that the UI uses. The UI doesn't
 * see Decimal, EN/TH pairs, or image relations — only the locale-
 * picked plain shape.
 */
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { pickI18n, type Locale, DEFAULT_LOCALE } from "./locale";
import { stripRichText } from "./sanitize";
import type { Product, PricingPlan } from "@/types";

const productWithRelations = Prisma.validator<Prisma.ProductDefaultArgs>()({
  include: {
    images: { orderBy: [{ isThumbnail: "desc" }, { displayOrder: "asc" }] },
    plans:  { where: { isActive: true }, orderBy: { displayOrder: "asc" } },
  },
});

type DbProductFull = Prisma.ProductGetPayload<typeof productWithRelations>;

// ── Public API ───────────────────────────────────────────────

export async function getActiveProducts(locale: Locale = DEFAULT_LOCALE): Promise<Product[]> {
  const rows = await db.product.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    ...productWithRelations,
  });
  // A product with no active plans isn't sellable — hide it from the
  // public shop rather than rendering a card with no price. Admin can
  // still see/edit it from /admin/products.
  return rows
    .filter((p) => p.plans.length > 0)
    .map((p) => normalize(p, locale));
}

export async function getProductBySlug(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Product | null> {
  const row = await db.product.findUnique({
    where: { slug },
    ...productWithRelations,
  });
  if (!row || !row.isActive) return null;
  return normalize(row, locale);
}

// ── Normalisation ────────────────────────────────────────────

function normalize(p: DbProductFull, locale: Locale): Product {
  const description = pickI18n(p.descriptionEn, p.descriptionTh, locale);
  // Return an empty array when no images exist; ProductCard and
  // ImageCarousel render a neutral "no image" placeholder in that case.
  // (Previously we substituted /images/JudyLegend.jpg, which made every
  // image-less product look like the Judy Legend mascot.)
  return {
    id: p.id,
    slug: p.slug,
    name: pickI18n(p.nameEn, p.nameTh, locale) || p.slug,
    shortName: pickI18n(p.shortNameEn, p.shortNameTh, locale) || undefined,
    description,
    descriptionPlain: stripRichText(description),
    images: p.images.map((i) => i.url),
    badge: p.badge ? (p.badge.toLowerCase() as Product["badge"]) : undefined,
    comingSoon: p.comingSoon,
    trialEnabled: p.trialEnabled,
    trialMinutes: p.trialMinutes,
    plans: p.plans.map((plan) => normalisePlan(plan, locale)),
  };
}

function normalisePlan(plan: DbProductFull["plans"][number], locale: Locale): PricingPlan {
  return {
    id: plan.id,
    label: pickI18n(plan.labelEn, plan.labelTh, locale) || "Plan",
    durationLabel: plan.isLifetime ? "Lifetime" : `${plan.durationDays ?? 0} days`,
    priceTHB: Number(plan.priceTHB),
    priceUSD: Number(plan.priceUSD),
  };
}
