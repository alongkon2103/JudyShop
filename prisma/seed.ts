/**
 * Seed entrypoint.
 *
 * Per request: NOT dumping the legacy whitelist data — schema only.
 * When ready to seed real data, fill in the functions below and run:
 *
 *   npm run db:seed
 */
import { db } from "@/lib/db";

async function main() {
  // Example placeholder — uncomment / extend when seeding is needed.
  //
  // await db.product.upsert({
  //   where: { slug: "judy-legend" },
  //   update: {},
  //   create: {
  //     slug: "judy-legend",
  //     name: "Judy Legend",
  //     description: "Legendary Roblox game powered by TikTok.",
  //     badge: "HOT",
  //     images: {
  //       create: [{ url: "/images/JudyLegend.png", isThumbnail: true }],
  //     },
  //     plans: {
  //       create: [
  //         { label: "30 DAYS / MONTH", durationDays: 30, priceTHB: 890, priceUSD: 30 },
  //         { label: "PERMANENT / LIFETIME ∞", isLifetime: true, priceTHB: 1500, priceUSD: 50 },
  //       ],
  //     },
  //   },
  // });

  console.log("Seed: nothing to do (schema only).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
