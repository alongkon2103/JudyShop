/**
 * Render `docs/quotation/quotation-judyshop-tikfinity.html` to PDF.
 * This is a NEW project quotation — pricing not yet committed, work
 * scoped but not delivered.
 *
 * Run:  npm run build:quotation:tikfinity
 * Out:  ProjectSpecification/Quotation_Judyshop_Tikfinity.pdf
 */
import { chromium } from "playwright";
import { resolve } from "node:path";
import { statSync, existsSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

async function main() {
  const repoRoot = resolve(__dirname, "..");
  const htmlPath = resolve(repoRoot, "docs/quotation/quotation-judyshop-tikfinity.html");
  const outDir   = resolve(repoRoot, "..", "ProjectSpecification");
  const pdfPath  = resolve(outDir, "Quotation_Judyshop_Tikfinity.pdf");

  if (!existsSync(htmlPath)) {
    console.error(`HTML source not found: ${htmlPath}`);
    process.exit(1);
  }
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const fileUrl = pathToFileURL(htmlPath).toString();
  console.log(`→ loading ${fileUrl}`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(fileUrl, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });

    await page.pdf({
      path:           pdfPath,
      format:         "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      displayHeaderFooter: false,
    });

    const { size } = statSync(pdfPath);
    console.log(`✓ wrote ${pdfPath}`);
    console.log(`  ${(size / 1024).toFixed(1)} KB`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
