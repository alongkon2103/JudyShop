import type { Metadata } from "next";
import { Lilita_One, Nunito, IBM_Plex_Sans_Thai_Looped, Mali } from "next/font/google";
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

// Thai body font — looped (วงกลม) characters read more naturally than the
// modern straight-line variant. Acts as a separate family in the fallback
// chain so Latin chars keep using Nunito while Thai chars get this.
const thaiBody = IBM_Plex_Sans_Thai_Looped({
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

// Thai display font — chunky + slightly playful to pair with Lilita One,
// since Lilita has no Thai glyphs.
const thaiDisplay = Mali({
  subsets: ["thai"],
  weight: ["500", "600", "700"],
  variable: "--font-thai-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s — ${SITE.name}` },
  description: SITE.description,
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
  thaiDisplay.variable,
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
