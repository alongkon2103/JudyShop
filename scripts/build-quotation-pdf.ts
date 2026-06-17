/**
 * Render `docs/quotation/quotation.html` to a PDF using Playwright's
 * Chromium — same pipeline as the manual builder. The HTML loads
 * Noto Sans Thai from Google Fonts so the resulting PDF has proper
 * Thai glyph rendering, embedded as font subsets.
 *
 * Run:  npm run build:quotation
 * Out:  ProjectSpecification/Quotation_Judyshop_v3.pdf
 *       (alongside the original v2 PDF the client already has)
 */
import { chromium } from "playwright";
import { resolve } from "node:path";
import { statSync, existsSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

async function main() {
  const repoRoot = resolve(__dirname, "..");
  const htmlPath = resolve(repoRoot, "docs/quotation/quotation.html");
  // Save alongside the original v2 PDF the client already has on disk
  // (one level up from the project root).
  const outDir = resolve(repoRoot, "..", "ProjectSpecification");
  const pdfPath = resolve(outDir, "Quotation_Judyshop_v3.pdf");

  if (!existsSync(htmlPath)) {
    console.error(`HTML source not found: ${htmlPath}`);
    process.exit(1);
  }
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const fileUrl = pathToFileURL(htmlPath).toString();
  console.log(`→ loading ${fileUrl}`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(fileUrl, { waitUntil: "networkidle" });
    // Belt-and-braces — make sure every @font-face is resolved before
    // we snapshot, otherwise the first run after a cold cache can
    // sometimes flash a system-font fallback.
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });

    await page.pdf({
      path: pdfPath,
      format: "A4",
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
