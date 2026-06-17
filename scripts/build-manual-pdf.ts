/**
 * Render `docs/manual/manual.html` to a printable PDF using Playwright's
 * Chromium. We load the file via the `file://` protocol so the page can
 * still fetch Google Fonts (Noto Sans Thai) for proper Thai glyphs, then
 * print A4 with `printBackground` so the cover gradient and badges keep
 * their colours.
 *
 * Run:  npx tsx scripts/build-manual-pdf.ts
 * Out:  docs/manual/manual.pdf
 */
import { chromium } from "playwright";
import { resolve } from "node:path";
import { statSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

async function main() {
  const repoRoot = resolve(__dirname, "..");
  const htmlPath = resolve(repoRoot, "docs/manual/manual.html");
  const pdfPath  = resolve(repoRoot, "docs/manual/manual.pdf");

  if (!existsSync(htmlPath)) {
    console.error(`HTML source not found: ${htmlPath}`);
    process.exit(1);
  }

  const fileUrl = pathToFileURL(htmlPath).toString();
  console.log(`→ loading ${fileUrl}`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // `networkidle` waits for Google Fonts + any resource fetches to
    // settle, which is what we want for consistent Thai glyph rendering.
    await page.goto(fileUrl, { waitUntil: "networkidle" });

    // Belt-and-braces: explicitly wait for the Noto Sans Thai face to
    // be ready before snapshotting. `document.fonts.ready` resolves
    // when all @font-face declarations have either loaded or failed.
    await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docFonts = (document as any).fonts;
      if (docFonts?.ready) await docFonts.ready;
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
