/**
 * Tests for the public product fetchers: `getActiveProducts` and
 * `getProductBySlug`. These run on the /shop page and product details
 * page, so the normalisation contract is what every page relies on:
 *
 *   - i18n: name/shortName/description picked per locale, with EN/TH
 *     fallback when one side is empty
 *   - images: empty image list falls back to a single placeholder so
 *     the UI never has a missing <img>
 *   - badge: lowercase normalisation (DB stores 'HOT' → UI sees 'hot')
 *   - plans: Decimal → number, durationLabel composed correctly
 *   - getProductBySlug returns null for missing OR inactive products
 *   - filters: isActive=true on list, sort by displayOrder+createdAt
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db", () => ({
  db: {
    product: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

import { getActiveProducts, getProductBySlug } from "../products";
import { db } from "../db";

// ── Fixtures ─────────────────────────────────────────────────

function makePlan(overrides: Partial<{
  id: string; labelEn: string; labelTh: string;
  isLifetime: boolean; durationDays: number | null;
  priceTHB: number; priceUSD: number; displayOrder: number;
}> = {}) {
  return {
    id:           overrides.id ?? "plan-30d",
    productId:    "prod-1",
    labelEn:      overrides.labelEn ?? "30 days",
    labelTh:      overrides.labelTh ?? "30 วัน",
    isLifetime:   overrides.isLifetime ?? false,
    durationDays: "durationDays" in overrides ? overrides.durationDays : 30,
    priceTHB:     overrides.priceTHB ?? 350,
    priceUSD:     overrides.priceUSD ?? 9.99,
    badge:        null,
    displayOrder: overrides.displayOrder ?? 0,
    isActive:     true,
  };
}

function makeRow(overrides: Partial<{
  id: string; slug: string;
  nameEn: string; nameTh: string;
  shortNameEn: string | null; shortNameTh: string | null;
  descriptionEn: string; descriptionTh: string;
  badge: "HOT" | "NEW" | "SALE" | null;
  isActive: boolean; comingSoon: boolean;
  images: { url: string }[];
  plans: ReturnType<typeof makePlan>[];
}> = {}) {
  return {
    id:        overrides.id ?? "prod-1",
    slug:      overrides.slug ?? "demo-game",
    nameEn:    overrides.nameEn ?? "Demo Game",
    nameTh:    overrides.nameTh ?? "เกมเดโม",
    shortNameEn: overrides.shortNameEn ?? null,
    shortNameTh: overrides.shortNameTh ?? null,
    descriptionEn: overrides.descriptionEn ?? "An English description.",
    descriptionTh: overrides.descriptionTh ?? "คำอธิบายภาษาไทย",
    shortDescriptionEn: null,
    shortDescriptionTh: null,
    badge: overrides.badge ?? null,
    gameId: "12345",
    isActive: overrides.isActive ?? true,
    comingSoon: overrides.comingSoon ?? false,
    displayOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    images: overrides.images ?? [],
    plans:  overrides.plans  ?? [makePlan()],
  };
}

beforeEach(() => vi.clearAllMocks());

// ── getActiveProducts ────────────────────────────────────────

describe("getActiveProducts — query", () => {
  it("filters by isActive=true", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([]);
    await getActiveProducts();
    const args = vi.mocked(db.product.findMany).mock.calls[0]![0]!;
    expect(args.where).toEqual({ isActive: true });
  });

  it("orders by displayOrder asc, then createdAt desc", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([]);
    await getActiveProducts();
    const args = vi.mocked(db.product.findMany).mock.calls[0]![0]!;
    expect(args.orderBy).toEqual([
      { displayOrder: "asc" },
      { createdAt: "desc" },
    ]);
  });

  it("includes images + active plans with correct ordering", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([]);
    await getActiveProducts();
    const args = vi.mocked(db.product.findMany).mock.calls[0]![0]!;
    expect(args.include).toEqual({
      images: { orderBy: [{ isThumbnail: "desc" }, { displayOrder: "asc" }] },
      plans:  { where: { isActive: true }, orderBy: { displayOrder: "asc" } },
    });
  });
});

describe("getActiveProducts — i18n normalisation", () => {
  it("picks the Thai name on locale='th'", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([makeRow() as any]);
    const r = await getActiveProducts("th");
    expect(r[0]!.name).toBe("เกมเดโม");
  });

  it("picks the English name on locale='en'", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([makeRow() as any]);
    const r = await getActiveProducts("en");
    expect(r[0]!.name).toBe("Demo Game");
  });

  it("falls back to slug when both name sides are empty", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      makeRow({ nameEn: "", nameTh: "", slug: "demo-fallback" }) as any,
    ]);
    const r = await getActiveProducts("th");
    expect(r[0]!.name).toBe("demo-fallback");
  });

  it("returns shortName undefined when both sides are empty", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      makeRow({ shortNameEn: null, shortNameTh: null }) as any,
    ]);
    const r = await getActiveProducts("th");
    expect(r[0]!.shortName).toBeUndefined();
  });

  it("returns shortName when at least one side is filled", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      makeRow({ shortNameEn: "Demo", shortNameTh: "" }) as any,
    ]);
    const r = await getActiveProducts("th");
    expect(r[0]!.shortName).toBe("Demo");
  });
});

describe("getActiveProducts — badges", () => {
  it("lowercases the badge ('HOT' → 'hot')", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      makeRow({ badge: "HOT" }) as any,
    ]);
    const r = await getActiveProducts();
    expect(r[0]!.badge).toBe("hot");
  });

  it("normalises NEW and SALE the same way", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      makeRow({ id: "a", slug: "a", badge: "NEW" }) as any,
      makeRow({ id: "b", slug: "b", badge: "SALE" }) as any,
    ]);
    const r = await getActiveProducts();
    expect(r[0]!.badge).toBe("new");
    expect(r[1]!.badge).toBe("sale");
  });

  it("returns undefined badge when none is set", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      makeRow({ badge: null }) as any,
    ]);
    const r = await getActiveProducts();
    expect(r[0]!.badge).toBeUndefined();
  });
});

describe("getActiveProducts — images", () => {
  it("uses each image URL in order when images are present", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      makeRow({
        images: [
          { url: "https://x/1.jpg" },
          { url: "https://x/2.jpg" },
        ],
      }) as any,
    ]);
    const r = await getActiveProducts();
    expect(r[0]!.images).toEqual(["https://x/1.jpg", "https://x/2.jpg"]);
  });

  it("falls back to the JudyLegend placeholder when no images exist", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      makeRow({ images: [] }) as any,
    ]);
    const r = await getActiveProducts();
    expect(r[0]!.images).toHaveLength(1);
    expect(r[0]!.images[0]).toMatch(/JudyLegend\./);
  });
});

describe("getActiveProducts — plans", () => {
  it("converts Decimal-shaped prices to numbers", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      makeRow({
        plans: [makePlan({ priceTHB: 350, priceUSD: 9.99 })],
      }) as any,
    ]);
    const r = await getActiveProducts();
    const plan = r[0]!.plans[0]!;
    expect(typeof plan.priceTHB).toBe("number");
    expect(plan.priceTHB).toBe(350);
    expect(plan.priceUSD).toBe(9.99);
  });

  it("uses 'Lifetime' as the durationLabel when isLifetime is true", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      makeRow({
        plans: [makePlan({ isLifetime: true, durationDays: null })],
      }) as any,
    ]);
    const r = await getActiveProducts();
    expect(r[0]!.plans[0]!.durationLabel).toBe("Lifetime");
  });

  it("composes 'Nd days' for duration plans", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      makeRow({ plans: [makePlan({ durationDays: 7 })] }) as any,
    ]);
    const r = await getActiveProducts();
    expect(r[0]!.plans[0]!.durationLabel).toBe("7 days");
  });

  it("defaults to '0 days' when durationDays is null on a non-lifetime plan", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      makeRow({
        plans: [makePlan({ isLifetime: false, durationDays: null })],
      }) as any,
    ]);
    const r = await getActiveProducts();
    expect(r[0]!.plans[0]!.durationLabel).toBe("0 days");
  });

  it("falls back the plan label to 'Plan' when both EN/TH labels are empty", async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      makeRow({
        plans: [makePlan({ labelEn: "", labelTh: "" })],
      }) as any,
    ]);
    const r = await getActiveProducts();
    expect(r[0]!.plans[0]!.label).toBe("Plan");
  });
});

// ── getProductBySlug ─────────────────────────────────────────

describe("getProductBySlug", () => {
  it("looks up by slug exactly", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValueOnce(null);
    await getProductBySlug("foo-bar");
    const args = vi.mocked(db.product.findUnique).mock.calls[0]![0]!;
    expect(args.where).toEqual({ slug: "foo-bar" });
  });

  it("returns null when no row is found", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValueOnce(null);
    expect(await getProductBySlug("ghost")).toBeNull();
  });

  it("returns null when the row exists but isActive=false (treat as 404)", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValueOnce(
      makeRow({ isActive: false }) as any,
    );
    expect(await getProductBySlug("inactive-slug")).toBeNull();
  });

  it("returns the normalised product on a hit", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValueOnce(
      makeRow({ slug: "demo", nameEn: "Demo", nameTh: "เดโม" }) as any,
    );
    const r = await getProductBySlug("demo", "en");
    expect(r).not.toBeNull();
    expect(r!.slug).toBe("demo");
    expect(r!.name).toBe("Demo");
  });
});
