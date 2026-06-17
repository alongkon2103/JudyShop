export const SITE = {
  name: "Judy Shop",
  /** Short, customer-facing tagline used under the hero + as og:site_name. */
  tagline: "ร้านจำหน่ายสิทธิ์ Whitelist สำหรับเกม TikTok Interactive",
  /** Default meta description (appears in search results + share previews). */
  description:
    "Judy Shop — ร้านจำหน่ายสิทธิ์ Whitelist สำหรับเกม TikTok Interactive อย่างเป็นทางการ ส่งมอบสิทธิ์ทันทีหลังชำระเงิน รองรับการชำระเงินผ่าน PromptPay และบัตรเครดิตอย่างปลอดภัย",
  /** English variant — used when locale=en or for international SEO. */
  descriptionEn:
    "Judy Shop — Official whitelist storefront for TikTok Interactive games. Instant access on payment, with secure PromptPay and credit card checkout.",
  keywords: [
    "TikTok Interactive",
    "Roblox",
    "Whitelist",
    "Judy Shop",
    "Judy Legend",
    "Judy Jump",
    "TikTok Live เกม",
    "ซื้อ Whitelist",
    "PromptPay",
  ],
  discordUrl: "https://discord.gg/ERV8KqRztF",
  tiktokUrl: "https://www.tiktok.com/@judyshop_th",
} as const;

export const NAV_ITEMS = [
  { label: "HOME", href: "/" },
  { label: "SHOP", href: "/shop" },
  { label: "NEWS", href: "/news" },
  { label: "ADMIN PANEL", href: "/admin" },
] as const;

export const LOCALES = ["TH", "EN"] as const;
export type Locale = (typeof LOCALES)[number];

