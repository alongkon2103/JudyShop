/**
 * One-shot importer: ingest `Data/whitelist_decrypted (1).xlsx` into the
 * Whitelist table.
 *
 * Sheet layout (one sheet per product, plus a "Summary" sheet ignored):
 *   sheetName  = product slug (e.g. "judy_legend")
 *   columns    = Username | Key | Expire Date | Label | Added At | Added By
 *
 * Mapping:
 *   "Expire Date" === "ไม่มีวันหมดอายุ"  → isLifetime=true,  expireDate=null
 *   "Expire Date" === ISO datetime       → isLifetime=false, expireDate=Date
 *   "Added By"    === "stripe"           → source=STRIPE
 *   "Added By"    === "payhip"           → source=PROMO  (legacy processor; full
 *                                          "Payhip: email" detail kept in Label)
 *   else                                 → source=MANUAL
 *
 * Missing products: sheets that don't match any Product.slug get a
 * placeholder Product row auto-created (isActive=false, comingSoon=true,
 * displayOrder=999) so the import doesn't drop ~2k legacy whitelist
 * entries. The admin then fills name/description/plans and flips
 * isActive when ready. Pass `--no-create-products` to opt out and skip
 * those sheets instead.
 *
 * Conflict policy: skip rows where (productId, username) already exists.
 * Skipping is implemented via `createMany({ skipDuplicates: true })` on a
 * pre-filtered list so we keep both speed (1 INSERT per product sheet)
 * and visibility (we still report what was skipped vs imported).
 *
 * Usage:
 *   npx tsx scripts/import-whitelist-xlsx.ts                          # default file
 *   npx tsx scripts/import-whitelist-xlsx.ts "myfile.xlsx"           # custom file
 *   npx tsx scripts/import-whitelist-xlsx.ts --dry-run               # parse only
 *   npx tsx scripts/import-whitelist-xlsx.ts "myfile.xlsx" --dry-run
 */
import { readFile, utils } from "xlsx";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { WhitelistSource } from "@prisma/client";
import { db } from "../src/lib/db";

const DEFAULT_FILE = "whitelist_decrypted (1).xlsx";
const SUMMARY_SHEET = "Summary";
const LIFETIME_MARKER = "ไม่มีวันหมดอายุ";

type RawRow = {
  Username?: unknown;
  Key?: unknown;
  "Expire Date"?: unknown;
  Label?: unknown;
  "Added At"?: unknown;
  "Added By"?: unknown;
};

type StagedRow = {
  productId: string;
  username: string;
  expireDate: Date | null;
  isLifetime: boolean;
  label: string | null;
  source: WhitelistSource;
  addedBy: string | null;
  addedAt: Date;
};

function sourceFromAddedBy(raw: string): WhitelistSource {
  const v = raw.toLowerCase().trim();
  if (v === "stripe") return "STRIPE";
  if (v === "payhip") return "PROMO";
  return "MANUAL";
}

/**
 * The xlsx sheet names use the same slug we expect on Product (e.g.
 * "judy_legend"). If a sheet doesn't match a product exactly, try
 * with `-` ↔ `_` swapped — both conventions exist in the wild.
 */
function findProductBySlug(
  sheetName: string,
  products: { id: string; slug: string; nameEn: string }[],
) {
  const tries = [
    sheetName,
    sheetName.replace(/_/g, "-"),
    sheetName.replace(/-/g, "_"),
  ];
  for (const slug of tries) {
    const hit = products.find((p) => p.slug === slug);
    if (hit) return hit;
  }
  return undefined;
}

/** "judy_jump" → "Judy Jump". Used to seed the placeholder nameEn/nameTh. */
function titleCase(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function parseExpire(raw: unknown): { expireDate: Date | null; isLifetime: boolean } | null {
  const s = String(raw ?? "").trim();
  if (!s || s === LIFETIME_MARKER) {
    return { expireDate: null, isLifetime: true };
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return { expireDate: d, isLifetime: false };
}

function parseAddedAt(raw: unknown): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  // Parse CLI: positional file name + flags, in any order.
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const noCreateProducts = args.includes("--no-create-products");
  const fileArg = args.find((a) => !a.startsWith("--"));
  const file = fileArg ?? DEFAULT_FILE;
  const xlsxPath = resolve(__dirname, "../../Data", file);

  if (!existsSync(xlsxPath)) {
    console.error(`File not found: ${xlsxPath}`);
    process.exit(1);
  }

  console.log(`${dryRun ? "[DRY RUN]" : "[IMPORT]"} ${xlsxPath}\n`);

  let products = await db.product.findMany({
    select: { id: true, slug: true, nameEn: true },
  });
  console.log(`Products in DB: ${products.length}`);

  const wb = readFile(xlsxPath);

  // ── Step 1: detect & (optionally) auto-create missing products. ──
  // We do this BEFORE bucketing rows so the second pass sees every
  // product slug. Without this step, sheets like "judy_jump" with
  // 1,512 rows would be silently dropped just because nobody created
  // the product yet.
  const missingSheets: string[] = [];
  for (const sheetName of wb.SheetNames) {
    if (sheetName === SUMMARY_SHEET) continue;
    if (!findProductBySlug(sheetName, products)) missingSheets.push(sheetName);
  }

  if (missingSheets.length > 0) {
    if (noCreateProducts) {
      console.log(`\nMissing products (would drop ${missingSheets.length} sheet(s) — --no-create-products):`);
      for (const slug of missingSheets) console.log(`  • ${slug}`);
    } else if (dryRun) {
      console.log(`\nWould create ${missingSheets.length} placeholder product(s):`);
      for (const slug of missingSheets) {
        const dashed = slug.replace(/_/g, "-");
        console.log(`  • ${slug.padEnd(14)} → "${dashed}" (${titleCase(slug)})`);
      }
    } else {
      console.log(`\nCreating ${missingSheets.length} placeholder product(s):`);
      for (const slug of missingSheets) {
        const dashed = slug.replace(/_/g, "-");
        const title = titleCase(slug);
        await db.product.create({
          data: {
            slug: dashed,
            nameEn: title,
            nameTh: title,
            descriptionEn:
              "Auto-imported from legacy whitelist data. Please update name, description, images, and plans.",
            descriptionTh:
              "นำเข้าจากข้อมูล whitelist เก่า กรุณาอัพเดทชื่อ คำอธิบาย รูปภาพ และ Plans",
            isActive: false,
            comingSoon: true,
            displayOrder: 999,
          },
        });
        console.log(`  ✓ "${dashed}" (${title}) — hidden, configure in /admin/products`);
      }
      // Refresh products list so the bucketing pass below finds them.
      products = await db.product.findMany({
        select: { id: true, slug: true, nameEn: true },
      });
    }
    console.log("");
  }

  // ── Plan: stage every (productId, username) we want to insert,
  //   then INSERT per product with skipDuplicates so the DB is the
  //   ultimate arbiter of duplicates. We also pre-filter against
  //   existing rows so we can report skip counts accurately. ──
  const staged: Record<string, StagedRow[]> = {};
  let invalidRows = 0;
  let unmatchedSheets = 0;

  for (const sheetName of wb.SheetNames) {
    if (sheetName === SUMMARY_SHEET) continue;

    const product = findProductBySlug(sheetName, products);
    if (!product) {
      console.log(`  • sheet "${sheetName}" — no matching product, skipping entire sheet`);
      unmatchedSheets++;
      continue;
    }

    const rows = utils.sheet_to_json<RawRow>(wb.Sheets[sheetName]!, { defval: null });
    console.log(`  • sheet "${sheetName}" → product "${product.slug}" (${product.nameEn}) — ${rows.length} rows`);

    const bucket: StagedRow[] = [];
    for (const row of rows) {
      const username = String(row.Username ?? "").trim();
      if (!username) {
        invalidRows++;
        continue;
      }

      const expire = parseExpire(row["Expire Date"]);
      if (!expire) {
        console.warn(`    ⚠ row "${username}" has unparseable Expire Date "${row["Expire Date"]}" — skipping`);
        invalidRows++;
        continue;
      }

      const addedAt = parseAddedAt(row["Added At"]) ?? new Date();
      const addedBy = String(row["Added By"] ?? "").trim() || null;
      const source = sourceFromAddedBy(String(row["Added By"] ?? ""));
      const label = row.Label != null && String(row.Label).trim() !== ""
        ? String(row.Label).trim()
        : null;

      bucket.push({
        productId: product.id,
        username,
        expireDate: expire.expireDate,
        isLifetime: expire.isLifetime,
        label,
        source,
        addedBy,
        addedAt,
      });
    }
    staged[product.id] = (staged[product.id] ?? []).concat(bucket);
  }

  // ── Pre-filter against existing rows — one SELECT per product to
  //   build a Set of "already-present usernames" then drop matches
  //   from `staged`. After this pass `toInsert` is what we will write. ──
  const toInsert: StagedRow[] = [];
  let skippedDuplicates = 0;
  for (const [productId, rows] of Object.entries(staged)) {
    const existing = await db.whitelist.findMany({
      where: { productId },
      select: { username: true },
    });
    const taken = new Set(existing.map((r) => r.username));
    for (const r of rows) {
      if (taken.has(r.username)) {
        skippedDuplicates++;
        continue;
      }
      toInsert.push(r);
      // Defend against duplicates within the same xlsx sheet.
      taken.add(r.username);
    }
  }

  console.log(`\nReady to ${dryRun ? "import (dry)" : "import"}: ${toInsert.length} rows`);
  console.log(`Skipped duplicates: ${skippedDuplicates}`);
  console.log(`Invalid rows:       ${invalidRows}`);
  console.log(`Unmatched sheets:   ${unmatchedSheets}`);

  if (dryRun) {
    console.log("\nDry run — no rows written.");
    return;
  }

  if (toInsert.length === 0) {
    console.log("\nNothing to insert.");
    return;
  }

  // Group by product so we can show per-product progress on large files.
  const byProduct = new Map<string, StagedRow[]>();
  for (const r of toInsert) {
    const list = byProduct.get(r.productId) ?? [];
    list.push(r);
    byProduct.set(r.productId, list);
  }

  let written = 0;
  for (const [productId, rows] of byProduct.entries()) {
    const slug = products.find((p) => p.id === productId)?.slug ?? productId;
    process.stdout.write(`  → inserting ${rows.length} into "${slug}"… `);
    const res = await db.whitelist.createMany({
      data: rows,
      skipDuplicates: true,
    });
    written += res.count;
    console.log(`${res.count} written`);
  }

  console.log(`\n✓ Done — ${written} rows inserted.`);
}

main()
  .catch((err) => {
    console.error("\n✗ Import failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
