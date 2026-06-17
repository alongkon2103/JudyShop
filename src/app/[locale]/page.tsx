import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/features/home/Hero";
import { AnnouncementPopup } from "@/components/features/site/AnnouncementPopup";
import { getActiveAnnouncement } from "@/lib/announcements";
import type { Locale } from "@/lib/locale";

// Refresh every 30s so admin announcement edits show up promptly
// without paying the cost of a fully dynamic render on every visit.
export const revalidate = 30;

export default async function HomePage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const announcement = await getActiveAnnouncement(params.locale as Locale);
  return (
    <>
      {/* The announcement popup is the LCP element on the home page,
          so preload its image in <head> to overlap the fetch with HTML
          parsing / JS hydration. Without this Lighthouse measures a
          multi-second "resource load delay". */}
      {announcement?.imageUrl && (
        <link
          rel="preload"
          as="image"
          href={announcement.imageUrl}
          fetchPriority="high"
        />
      )}
      <Hero />
      {announcement && (
        <AnnouncementPopup
          id={announcement.id}
          message={announcement.message}
          imageUrl={announcement.imageUrl}
          updatedAt={announcement.updatedAt}
        />
      )}
    </>
  );
}
