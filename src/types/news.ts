export type NewsCategory = "update" | "announce" | "event" | "maintenance";

export type NewsItem = {
  id: string;
  date: string;   // ISO date (e.g. "2026-06-01")
  category: NewsCategory;
  title: string;
  excerpt: string;
};
