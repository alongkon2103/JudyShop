import { NextResponse, type NextRequest } from "next/server";
import { chromium } from "playwright";
import { requireAdmin } from "@/lib/admin-session";
import { getMonthlyFinance, parseMonthKey } from "@/lib/finance";
import { renderFinancePdfHtml } from "@/lib/finance-pdf-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Playwright launches Chromium; ~2-3 seconds per PDF is fine for a
// rarely-clicked admin download but is well above the default
// Vercel-style 10s budget — bumping the cap here keeps the route
// responsive even when the page tree is large.
export const maxDuration = 60;

/**
 * GET /admin/finance/export/pdf?month=YYYY-MM
 *
 * Server-renders the finance HTML template, feeds it into a headless
 * Chromium, and streams the resulting PDF back to the browser with a
 * filename matching the agreed `finance_YYYY-MM_judygamestudio.pdf`
 * format.
 *
 * Caveat: the host running `pm2 start` needs Playwright's Chromium
 * binary installed (`npx playwright install chromium`). The audit
 * script and the manual builder need the same binary so this isn't
 * an extra cost in practice — but mention it in the deploy docs.
 */
export async function GET(req: NextRequest) {
  await requireAdmin();

  const { year, month } = parseMonthKey(req.nextUrl.searchParams.get("month"));
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const data = await getMonthlyFinance(year, month);

  const html = renderFinancePdfHtml(data, {
    year,
    month,
    generatedAt: new Date(),
  });

  // ── Render via Chromium ──────────────────────────────────────────
  const browser = await chromium.launch();
  let pdf: Buffer;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    // Wait for Noto Sans Thai to actually be ready before snapshot.
    // `document.fonts` is a standard FontFaceSet in modern DOMs, so we
    // can call it without an `any` cast — keeps the linter happy.
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } finally {
    await browser.close();
  }

  // Wrap in a Uint8Array view to satisfy NextResponse's BodyInit
  // type; Buffer extends Uint8Array but TS doesn't infer through.
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type":        "application/pdf",
      "content-disposition": `attachment; filename="finance_${monthKey}_judygamestudio.pdf"`,
      "cache-control":       "no-store",
    },
  });
}
