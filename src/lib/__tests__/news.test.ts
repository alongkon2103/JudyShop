/**
 * Tests for `getPublishedNews` — the `/news` page data fetcher.
 *
 * Contract:
 *   1. Filter: isPublished = true AND publishedAt <= now (so admins
 *      can schedule articles for the future).
 *   2. Order: publishedAt desc (newest first).
 *   3. Limit: default 20, overrideable.
 *   4. Category: lowercased ("UPDATE" → "update") to match the
 *      Tailwind utility classes the UI keys off.
 *   5. Title / excerpt: locale-aware via pickI18n.
 *   6. publishedAt: serialised as ISO string.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db", () => ({
  db: { news: { findMany: vi.fn() } },
}));

import { getPublishedNews } from "../news";
import { db } from "../db";

function makeNews(overrides: Partial<{
  id: string;
  category: "UPDATE" | "ANNOUNCE" | "EVENT" | "MAINTENANCE";
  titleEn: string; titleTh: string;
  excerptEn: string; excerptTh: string;
  imageUrl: string | null;
  publishedAt: Date;
}> = {}) {
  return {
    id:        overrides.id ?? "news-1",
    category:  overrides.category ?? "UPDATE",
    titleEn:   overrides.titleEn ?? "Patch notes 1.0",
    titleTh:   overrides.titleTh ?? "อัปเดต 1.0",
    excerptEn: overrides.excerptEn ?? "Lots of fixes.",
    excerptTh: overrides.excerptTh ?? "แก้บั๊กเยอะ",
    bodyEn:    "long body",
    bodyTh:    "เนื้อหายาว",
    imageUrl:  overrides.imageUrl ?? null,
    isPublished: true,
    publishedAt: overrides.publishedAt ?? new Date("2026-06-01T00:00:00Z"),
    createdAt: new Date(), updatedAt: new Date(),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("getPublishedNews — Prisma query", () => {
  it("filters published items with publishedAt <= now", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T12:00:00Z"));
    vi.mocked(db.news.findMany).mockResolvedValueOnce([]);

    await getPublishedNews();
    const args = vi.mocked(db.news.findMany).mock.calls[0]![0]!;
    expect(args.where).toEqual({
      isPublished: true,
      publishedAt: { lte: new Date("2026-06-08T12:00:00Z") },
    });
    vi.useRealTimers();
  });

  it("orders by publishedAt desc", async () => {
    vi.mocked(db.news.findMany).mockResolvedValueOnce([]);
    await getPublishedNews();
    const args = vi.mocked(db.news.findMany).mock.calls[0]![0]!;
    expect(args.orderBy).toEqual({ publishedAt: "desc" });
  });

  it("takes 20 items by default", async () => {
    vi.mocked(db.news.findMany).mockResolvedValueOnce([]);
    await getPublishedNews();
    const args = vi.mocked(db.news.findMany).mock.calls[0]![0]!;
    expect(args.take).toBe(20);
  });

  it("respects a custom limit", async () => {
    vi.mocked(db.news.findMany).mockResolvedValueOnce([]);
    await getPublishedNews("th", 5);
    const args = vi.mocked(db.news.findMany).mock.calls[0]![0]!;
    expect(args.take).toBe(5);
  });
});

describe("getPublishedNews — normalisation", () => {
  it("lowercases the category for UI consumption", async () => {
    vi.mocked(db.news.findMany).mockResolvedValueOnce([
      makeNews({ category: "UPDATE" }) as any,
      makeNews({ id: "2", category: "MAINTENANCE" }) as any,
    ]);
    const r = await getPublishedNews();
    expect(r[0]!.category).toBe("update");
    expect(r[1]!.category).toBe("maintenance");
  });

  it("picks the Thai title on locale='th'", async () => {
    vi.mocked(db.news.findMany).mockResolvedValueOnce([
      makeNews({ titleEn: "Hi", titleTh: "สวัสดี" }) as any,
    ]);
    const r = await getPublishedNews("th");
    expect(r[0]!.title).toBe("สวัสดี");
  });

  it("picks the English title on locale='en'", async () => {
    vi.mocked(db.news.findMany).mockResolvedValueOnce([
      makeNews({ titleEn: "Hi", titleTh: "สวัสดี" }) as any,
    ]);
    const r = await getPublishedNews("en");
    expect(r[0]!.title).toBe("Hi");
  });

  it("serialises publishedAt as ISO string", async () => {
    const at = new Date("2026-06-01T10:30:00Z");
    vi.mocked(db.news.findMany).mockResolvedValueOnce([
      makeNews({ publishedAt: at }) as any,
    ]);
    const r = await getPublishedNews();
    expect(r[0]!.publishedAt).toBe(at.toISOString());
  });

  it("preserves imageUrl as null when none is set", async () => {
    vi.mocked(db.news.findMany).mockResolvedValueOnce([
      makeNews({ imageUrl: null }) as any,
    ]);
    const r = await getPublishedNews();
    expect(r[0]!.imageUrl).toBeNull();
  });

  it("preserves an imageUrl when set", async () => {
    vi.mocked(db.news.findMany).mockResolvedValueOnce([
      makeNews({ imageUrl: "https://cdn/x.png" }) as any,
    ]);
    const r = await getPublishedNews();
    expect(r[0]!.imageUrl).toBe("https://cdn/x.png");
  });

  it("returns an empty array when nothing is published", async () => {
    vi.mocked(db.news.findMany).mockResolvedValueOnce([]);
    expect(await getPublishedNews()).toEqual([]);
  });

  it("returns the expected public shape (no DB-only fields leak)", async () => {
    vi.mocked(db.news.findMany).mockResolvedValueOnce([makeNews() as any]);
    const r = await getPublishedNews();
    expect(Object.keys(r[0]!).sort()).toEqual([
      "category", "excerpt", "id", "imageUrl", "publishedAt", "title",
    ]);
  });
});
