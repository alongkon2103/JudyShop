export const SITE = {
  name: "Judy Shop",
  tagline: "Your trusted Interactive games store instant delivery, every time.",
  description:
    "Judy Shop — สิทธิ์เข้าเกม TikTok Interactive พร้อมส่งทันทีหลังชำระเงิน",
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

