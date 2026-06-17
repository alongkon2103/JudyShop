import type { Metadata } from "next";
import { Lilita_One, Nunito, IBM_Plex_Sans_Thai_Looped } from "next/font/google";
import "./globals.css";
import { SITE } from "@/constants/site";

const lilita = Lilita_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-lilita",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

// Single Thai face for the entire site — looped (วงกลม) characters read
// more naturally than the modern straight-line variant. We use the same
// font for both body and display Thai text so headings and paragraphs
// feel consistent across every page; the Latin fonts (Lilita / Nunito)
// still provide visual hierarchy for English copy.
const thaiBody = IBM_Plex_Sans_Thai_Looped({
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

// Absolute base used to resolve every relative URL inside the metadata
// tree (og:image, twitter:image, alternates.canonical, etc.). Picked from
// NEXT_PUBLIC_SITE_URL when present so prod and preview render different
// previews, falls back to the production hostname.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://judygamestudio.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE.name, template: `%s — ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [...SITE.keywords],
  authors: [{ name: SITE.name }],
  creator: SITE.name,
  publisher: SITE.name,
  // Social previews — both OG and Twitter consume the same image file
  // placed at app/opengraph-image.jpg; Next.js auto-emits the right tags.
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
    locale: "th_TH",
    alternateLocale: ["en_US"],
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "shopping",
};

/** Inline pre-paint script — applies saved theme to <html> before body renders. */
const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem('judyshop_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
} catch (e) {
  document.documentElement.setAttribute('data-theme', 'dark');
}
`;

const FONT_VARS = [
  lilita.variable,
  nunito.variable,
  thaiBody.variable,
].join(" ");

/**
 * Root layout is intentionally minimal: <html>, <body>, fonts and the theme
 * pre-paint script. All chrome (public navbar / admin shell) is decided by
 * route-group layouts: app/[locale]/layout.tsx and app/admin/layout.tsx.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={FONT_VARS}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
