/**
 * One-off inspector: prints the sheet names, column headers, row count
 * and a 5-row sample of `../Data/whitelist.xlsx`. Used to decide the
 * import script's column mapping; not part of normal workflow.
 *
 * Run:  npx tsx scripts/inspect-whitelist-xlsx.ts
 */
import { readFile, utils } from "xlsx";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const XLSX_PATH = resolve(
  __dirname,
  "../../Data",
  process.argv[2] ?? "whitelist.xlsx",
);

if (!existsSync(XLSX_PATH)) {
  console.error(`File not found: ${XLSX_PATH}`);
  process.exit(1);
}

console.log(`→ reading ${XLSX_PATH}\n`);
const wb = readFile(XLSX_PATH);

console.log(`Sheets: ${wb.SheetNames.join(", ")}\n`);

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const ref = ws["!ref"] ?? "(empty)";
  const rows = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  console.log(`── Sheet "${name}" ── (range: ${ref}, ${rows.length} data rows)`);

  if (rows.length === 0) {
    console.log("  (no rows)\n");
    continue;
  }

  const headers = Object.keys(rows[0] as Record<string, unknown>);
  console.log(`  Headers: ${JSON.stringify(headers)}`);

  console.log(`  All ${rows.length} rows:`);
  for (const r of rows) {
    console.log(`    ${JSON.stringify(r)}`);
  }
  console.log();
}
