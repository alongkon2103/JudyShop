import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans_Thai_Looped, Lilita_One } from "next/font/google";
import "./globals.css";
import { SITE } from "@/constants/site";

// ── Type stack ─────────────────────────────────────────────────
//
// Three faces, all 100% free for commercial use:
//
//   - Inter (SIL OFL 1.1) → Latin script for body + general UI.
//     The de facto standard for readable web copy (Figma, GitHub,
//     Mozilla all ship it).
//   - IBM Plex Sans Thai Looped (Apache 2.0) → Thai script. The
//     looped (วงกลม) characters read more naturally than the modern
//     straight-line variant; designed to pair with IBM Plex Sans so
//     it sits cleanly next to Inter on mixed-script pages.
//   - Lilita One (SIL OFL 1.1) → reserved exclusively for the
//     "JUDY SHOP" hero wordmark. Its chunky display weight is the
//     visual signature of the brand. We expose it via its own
//     `--font-hero` variable so it never bleeds into body text.
//
// Browsers do per-glyph fallback, so Latin chars route to Inter and
// Thai chars to IBM Plex automatically — no manual font switching
// per element.
const latin = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-latin",
  display: "swap",
});

const thai = IBM_Plex_Sans_Thai_Looped({
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

const hero = Lilita_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hero",
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
  // placed at app/opengraph-image.png; Next.js auto-emits the right tags.
  // Primary locale is en_US because our largest audience is international
  // TikTok Live viewers; Thai is exposed as alternateLocale so localised
  // crawlers (Google Thailand etc.) still pick up the th_TH preview.
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
    locale: "en_US",
    alternateLocale: ["th_TH"],
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

const FONT_VARS = [latin.variable, thai.variable, hero.variable].join(" ");

/**
 * Root layout is intentionally minimal: <html>, <body>, fonts and the theme
 * pre-paint script. All chrome (public navbar / admin shell) is decided by
 * route-group layouts: app/[locale]/layout.tsx and app/admin/layout.tsx.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_INIT_SCRIPT sets data-theme on <html>
    // before React hydrates, so the server markup and the client's first
    // render intentionally differ on that one attribute. This suppresses
    // *only* this element's attribute diff (React never cascades it to
    // children) — without it the mismatch can escalate into a full
    // "error while hydrating → switch to client rendering" once any client
    // component on the page hydrates.
    <html lang="en" className={FONT_VARS} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
