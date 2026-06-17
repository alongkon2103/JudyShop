export const SITE = {
  name: "Judy Shop",
  /** Short, customer-facing tagline — used under the hero, as the
   *  og:site_name fallback, and as Twitter's title. English-first
   *  because our primary audience is international TikTok Live
   *  viewers. */
  tagline: "Official Whitelist Storefront for TikTok Interactive Games",
  /** Default meta description (appears in search results + share
   *  previews). Lead with English; the Thai variant is exposed as
   *  `descriptionTh` for locale=th routes. */
  description:
    "Judy Shop — the official whitelist storefront for TikTok Interactive games. Get instant access right after payment. Secure checkout via Stripe (credit card) and PromptPay. Trusted by streamers and viewers worldwide.",
  /** Thai variant — used by the localised pages under /th. */
  descriptionTh:
    "Judy Shop — ร้านจำหน่ายสิทธิ์ Whitelist สำหรับเกม TikTok Interactive อย่างเป็นทางการ ส่งมอบสิทธิ์ทันทีหลังชำระเงิน รองรับ Stripe (บัตรเครดิต) และ PromptPay",
  /** Search keywords. English terms first since they drive the most
   *  international SEO traffic; the Thai tail still helps capture
   *  local intent. */
  keywords: [
    "TikTok Interactive",
    "TikTok Interactive games",
    "TikTok Live games",
    "Roblox whitelist",
    "Whitelist subscription",
    "Judy Shop",
    "Judy Legend",
    "Judy Jump",
    "Buy whitelist",
    "PromptPay checkout",
    "ซื้อ Whitelist",
    "ไวลิสต์ TikTok Interactive",
  ],
  discordUrl: "https://discord.gg/ERV8KqRztF",
  tiktokUrl: "https://www.tiktok.com/@judyshop_th",
  youtubeUrl: "https://www.youtube.com/@JUDYSHOP-TH",
  supportEmail: "judyshop0330@gmail.com",
} as const;

export const NAV_ITEMS = [
  { label: "HOME", href: "/" },
  { label: "SHOP", href: "/shop" },
  { label: "NEWS", href: "/news" },
  { label: "ADMIN PANEL", href: "/admin" },
] as const;

export const LOCALES = ["TH", "EN"] as const;
export type Locale = (typeof LOCALES)[number];

