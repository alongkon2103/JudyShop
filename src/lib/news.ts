/**
 * Public news fetcher.
 * Returns published items ordered by publishedAt desc.
 */
import { db } from "./db";
import { pickI18n, type Locale, DEFAULT_LOCALE } from "./locale";

export type NewsCategoryKey = "update" | "announce" | "event" | "maintenance";

export type PublicNewsItem = {
  id: string;
  category: NewsCategoryKey;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  publishedAt: string;
};

export async function getPublishedNews(
  locale: Locale = DEFAULT_LOCALE,
  limit = 20,
): Promise<PublicNewsItem[]> {
  const rows = await db.news.findMany({
    where: { isPublished: true, publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
  return rows.map((n) => ({
    id: n.id,
    category: n.category.toLowerCase() as NewsCategoryKey,
    title: pickI18n(n.titleEn, n.titleTh, locale),
    excerpt: pickI18n(n.excerptEn, n.excerptTh, locale),
    imageUrl: n.imageUrl,
    publishedAt: n.publishedAt.toISOString(),
  }));
}
