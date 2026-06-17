/**
 * Public announcement fetcher.
 *
 * Returns the single "best" active announcement to show as a popup
 * on the site. Filter: isActive AND startDate ≤ now AND (endDate IS
 * NULL OR endDate > now). Order: priority desc, then newest first.
 *
 * Either / both `message` and `imageUrl` can be present — image-only
 * (poster) announcements are valid.
 */
import { db } from "./db";
import { pickI18n, type Locale, DEFAULT_LOCALE } from "./locale";

export type PublicAnnouncement = {
  id: string;
  message: string | null;
  imageUrl: string | null;
  updatedAt: string;
};

export async function getActiveAnnouncement(
  locale: Locale = DEFAULT_LOCALE,
): Promise<PublicAnnouncement | null> {
  const now = new Date();
  const row = await db.announcement.findFirst({
    where: {
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gt: now } }],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  if (!row) return null;

  const message = pickI18n(row.messageEn, row.messageTh, locale).trim();
  const imageUrl = row.imageUrl?.trim() || null;
  // If both are empty, nothing to show.
  if (!message && !imageUrl) return null;

  return {
    id: row.id,
    message: message.length ? message : null,
    imageUrl,
    updatedAt: row.updatedAt.toISOString(),
  };
}
