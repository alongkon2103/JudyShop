/**
 * End-to-end audit for the public site.
 *
 * For each route in ROUTES this script:
 *   1. Loads the page in Playwright (Chromium) with console + network
 *      listeners attached, takes a full-page screenshot, runs axe-core.
 *   2. Runs a Lighthouse CLI pass against the same URL (json + html
 *      output, full report saved to disk for offline drill-down).
 *   3. Distils everything into a per-route summary and writes:
 *        audit/report.json                — machine-readable summary
 *        audit/report.md                  — human-readable markdown
 *        audit/screenshots/<slug>.png     — fold + below
 *        audit/lighthouse/<slug>.report.json|html  — full LH reports
 *        audit/axe/<slug>.json            — full axe violations
 *
 * Env flags:
 *   HEADED=1   Open a visible Chromium for the Playwright pass.
 *   MOBILE=1   Run Lighthouse with the mobile preset (default = desktop).
 *   ROUTES=... Comma-separated override of the route list.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = "http://localhost:3000";

const HEADED = process.env.HEADED === "1";
const MOBILE = process.env.MOBILE === "1";

const DEFAULT_ROUTES = [
  "/",
  "/shop",
  "/news",
  "/check",
  "/faq",
  "/th",
  "/th/shop",
];

const ROUTES = process.env.ROUTES
  ? process.env.ROUTES.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_ROUTES;

const OUT = "audit";
const OUT_SCREENSHOTS = path.join(OUT, "screenshots");
const OUT_LIGHTHOUSE = path.join(OUT, "lighthouse");
const OUT_AXE = path.join(OUT, "axe");

// ─────────────────────────────────────────────────────────────────────
// Types — kept narrow so consumers of report.json get autocomplete.
// ─────────────────────────────────────────────────────────────────────

interface LhMetric {
  /** 0..1 LH score (null = not applicable). */
  score: number | null;
  /** Human-readable e.g. "2.3 s" or "0.12". */
  displayValue: string | null;
  /** Raw numeric value in LH's internal unit (ms / unitless). */
  numericValue: number | null;
}

interface LhOpportunity {
  id: string;
  title: string;
  /** Estimated ms saved if applied — for `opportunity` audits. */
  estimatedSavingsMs: number;
  /** A short summary so the report.json is grep-able without opening the HTML. */
  displayValue: string | null;
}

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  /** CSS selectors of the failing nodes. */
  nodes: string[];
}

interface NetworkError {
  status: number;
  method: string;
  url: string;
}

interface AuditResult {
  route: string;
  url: string;
  /** Wall-clock ms from goto() to networkidle. */
  loadMs: number;
  resources: {
    count: number;
    totalBytes: number;
  };
  lighthouse: {
    preset: "mobile" | "desktop";
    performance: number;
    accessibility: number;
    seo: number;
    bestPractices: number;
    metrics: {
      firstContentfulPaint: LhMetric;
      largestContentfulPaint: LhMetric;
      totalBlockingTime: LhMetric;
      cumulativeLayoutShift: LhMetric;
      speedIndex: LhMetric;
      interactive: LhMetric;
    };
    /** Top opportunities by potential ms saved, capped at 8. */
    topOpportunities: LhOpportunity[];
    /** Audits that scored < 0.9 and are flagged "diagnostic", capped at 8. */
    topDiagnostics: LhOpportunity[];
  };
  axe: {
    violationsCount: number;
    /** Histogram by impact (critical/serious/moderate/minor). */
    byImpact: Record<string, number>;
    violations: AxeViolation[];
  };
  consoleErrors: string[];
  pageErrors: string[];
  networkErrors: NetworkError[];
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function scoreOf(value: number | null | undefined): number {
  return Math.round((value ?? 0) * 100);
}

function slugOf(route: string): string {
  if (route === "/") return "home";
  return route.replace(/^\//, "").replaceAll("/", "_");
}

function ensureDirs() {
  for (const dir of [OUT_SCREENSHOTS, OUT_LIGHTHOUSE, OUT_AXE]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractMetric(audits: Record<string, any>, id: string): LhMetric {
  const a = audits[id];
  if (!a) return { score: null, displayValue: null, numericValue: null };
  return {
    score: a.score ?? null,
    displayValue: a.displayValue ?? null,
    numericValue: a.numericValue ?? null,
  };
}

/**
 * Walk every audit. Anything with `details.overallSavingsMs > 0` is an
 * "opportunity"; anything else that scored under 0.9 is a "diagnostic".
 * Returns both buckets sorted by impact (savings desc, then score asc).
 */
function extractOpportunitiesAndDiagnostics(audits: Record<string, any>): {
  topOpportunities: LhOpportunity[];
  topDiagnostics: LhOpportunity[];
} {
  const opportunities: LhOpportunity[] = [];
  const diagnostics: LhOpportunity[] = [];

  for (const [id, a] of Object.entries<any>(audits)) {
    if (!a || typeof a !== "object") continue;
    const savings = a.details?.overallSavingsMs ?? 0;
    if (savings > 0) {
      opportunities.push({
        id,
        title: a.title ?? id,
        estimatedSavingsMs: Math.round(savings),
        displayValue: a.displayValue ?? null,
      });
      continue;
    }
    const score = a.score;
    if (score !== null && score !== undefined && score < 0.9) {
      diagnostics.push({
        id,
        title: a.title ?? id,
        estimatedSavingsMs: 0,
        displayValue: a.displayValue ?? null,
      });
    }
  }

  opportunities.sort((a, b) => b.estimatedSavingsMs - a.estimatedSavingsMs);
  diagnostics.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));

  return {
    topOpportunities: opportunities.slice(0, 8),
    topDiagnostics: diagnostics.slice(0, 8),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Lighthouse CLI
// ─────────────────────────────────────────────────────────────────────

/**
 * Run Lighthouse against `url` as a child process. We can't `import
 * lighthouse from "lighthouse"` inside this tsx-run script: tsx (esbuild)
 * rewrites Lighthouse's modules with `__name(...)` helpers, those leak
 * into the eval'd browser code, and Chromium dies with `__name is not
 * defined`. A child process loads lighthouse via plain node, no
 * transform, no leak.
 *
 * Writes <outBase>.report.json + <outBase>.report.html and returns the
 * path to the json file.
 */
function runLighthouseCli(url: string, outBase: string): Promise<string> {
  const args = [
    "--yes",
    "lighthouse",
    url,
    "--quiet",
    "--output=json",
    "--output=html",
    `--output-path=${outBase}`,
    "--chrome-flags=--headless",
    "--only-categories=performance,accessibility,seo,best-practices",
    `--preset=${MOBILE ? "perf" : "desktop"}`,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("npx", args, { env: process.env });

    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(`${outBase}.report.json`);
      else reject(new Error(`lighthouse exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function runLighthouse(url: string, outBase: string) {
  const jsonPath = await runLighthouseCli(url, outBase);
  const lhr = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const categories = lhr.categories ?? {};
  const audits = lhr.audits ?? {};

  const { topOpportunities, topDiagnostics } =
    extractOpportunitiesAndDiagnostics(audits);

  return {
    preset: (MOBILE ? "mobile" : "desktop") as "mobile" | "desktop",
    performance: scoreOf(categories.performance?.score),
    accessibility: scoreOf(categories.accessibility?.score),
    seo: scoreOf(categories.seo?.score),
    bestPractices: scoreOf(categories["best-practices"]?.score),
    metrics: {
      firstContentfulPaint: extractMetric(audits, "first-contentful-paint"),
      largestContentfulPaint: extractMetric(audits, "largest-contentful-paint"),
      totalBlockingTime: extractMetric(audits, "total-blocking-time"),
      cumulativeLayoutShift: extractMetric(audits, "cumulative-layout-shift"),
      speedIndex: extractMetric(audits, "speed-index"),
      interactive: extractMetric(audits, "interactive"),
    },
    topOpportunities,
    topDiagnostics,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Per-route Playwright pass (screenshot + axe + listeners)
// ─────────────────────────────────────────────────────────────────────

async function auditRoute(route: string): Promise<AuditResult> {
  const slug = slugOf(route);
  const url = `${BASE_URL}${route}`;

  const browser = await chromium.launch({
    headless: !HEADED,
    slowMo: HEADED ? 400 : 0,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const networkErrors: NetworkError[] = [];
    let resourceCount = 0;
    let totalBytes = 0;

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(`${err.name}: ${err.message}`);
    });
    page.on("response", async (response) => {
      resourceCount += 1;
      // Sum content-length where the server tells us — best-effort,
      // not a guarantee. We avoid `.body()` so we don't pay to buffer
      // entire images just to add up bytes.
      const len = Number(response.headers()["content-length"] ?? 0);
      if (Number.isFinite(len)) totalBytes += len;

      if (response.status() >= 400) {
        networkErrors.push({
          status: response.status(),
          method: response.request().method(),
          url: response.url(),
        });
      }
    });

    const start = Date.now();
    await page.goto(url, { waitUntil: "networkidle" });
    const loadMs = Date.now() - start;

    // axe — full results, not just count. Save the raw output too so
    // we can re-analyse without re-running the audit.
    const axe = await new AxeBuilder({ page }).analyze();
    const violations: AxeViolation[] = axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.flatMap((n) => n.target as string[]),
    }));
    const byImpact: Record<string, number> = {};
    for (const v of violations) {
      const key = v.impact ?? "unknown";
      byImpact[key] = (byImpact[key] ?? 0) + 1;
    }
    fs.writeFileSync(
      path.join(OUT_AXE, `${slug}.json`),
      JSON.stringify(axe, null, 2),
    );

    await page.screenshot({
      path: path.join(OUT_SCREENSHOTS, `${slug}.png`),
      fullPage: true,
    });

    // Lighthouse takes ~15-30s; doing it after Playwright closes its
    // own Chromium avoids the two competing for resources.
    await browser.close();
    const lighthouse = await runLighthouse(
      url,
      path.join(OUT_LIGHTHOUSE, slug),
    );

    return {
      route,
      url,
      loadMs,
      resources: { count: resourceCount, totalBytes },
      lighthouse,
      axe: {
        violationsCount: violations.length,
        byImpact,
        violations,
      },
      consoleErrors,
      pageErrors,
      networkErrors,
    };
  } finally {
    // browser.close() is already called above on the happy path; this
    // catches the case where it threw before we got there.
    if (browser.isConnected()) await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────
// Markdown report
// ─────────────────────────────────────────────────────────────────────

function bytesToKb(n: number): string {
  return `${(n / 1024).toFixed(0)} KB`;
}

function emojiForScore(n: number): string {
  if (n >= 90) return "🟢";
  if (n >= 50) return "🟡";
  return "🔴";
}

function renderMarkdown(results: AuditResult[]): string {
  const preset = MOBILE ? "mobile" : "desktop";
  const lines: string[] = [];

  lines.push(`# Audit report`);
  lines.push("");
  lines.push(`**Preset:** ${preset}  ·  **Routes:** ${results.length}  ·  **Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`| Route | Perf | A11y | SEO | BP | axe | LCP | TBT | CLS | Bytes |`);
  lines.push(`|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|`);
  for (const r of results) {
    const lh = r.lighthouse;
    lines.push(
      `| \`${r.route}\` ` +
        `| ${emojiForScore(lh.performance)} ${lh.performance} ` +
        `| ${emojiForScore(lh.accessibility)} ${lh.accessibility} ` +
        `| ${emojiForScore(lh.seo)} ${lh.seo} ` +
        `| ${emojiForScore(lh.bestPractices)} ${lh.bestPractices} ` +
        `| ${r.axe.violationsCount} ` +
        `| ${lh.metrics.largestContentfulPaint.displayValue ?? "—"} ` +
        `| ${lh.metrics.totalBlockingTime.displayValue ?? "—"} ` +
        `| ${lh.metrics.cumulativeLayoutShift.displayValue ?? "—"} ` +
        `| ${bytesToKb(r.resources.totalBytes)} |`,
    );
  }
  lines.push("");

  for (const r of results) {
    lines.push(`## \`${r.route}\``);
    lines.push("");
    lines.push(`- LCP: **${r.lighthouse.metrics.largestContentfulPaint.displayValue ?? "—"}**, TBT: **${r.lighthouse.metrics.totalBlockingTime.displayValue ?? "—"}**, CLS: **${r.lighthouse.metrics.cumulativeLayoutShift.displayValue ?? "—"}**, SI: ${r.lighthouse.metrics.speedIndex.displayValue ?? "—"}`);
    lines.push(`- Load (Playwright networkidle): ${r.loadMs} ms, ${r.resources.count} requests, ~${bytesToKb(r.resources.totalBytes)}`);
    lines.push(`- Full Lighthouse: [\`audit/lighthouse/${slugOf(r.route)}.report.html\`](./lighthouse/${slugOf(r.route)}.report.html)`);
    lines.push("");

    if (r.lighthouse.topOpportunities.length > 0) {
      lines.push(`### Top opportunities`);
      lines.push("");
      for (const o of r.lighthouse.topOpportunities) {
        lines.push(`- **${o.title}** — save ~${o.estimatedSavingsMs} ms${o.displayValue ? ` _(${o.displayValue})_` : ""}`);
      }
      lines.push("");
    }

    if (r.lighthouse.topDiagnostics.length > 0) {
      lines.push(`### Diagnostics scoring < 0.9`);
      lines.push("");
      for (const d of r.lighthouse.topDiagnostics) {
        lines.push(`- **${d.title}**${d.displayValue ? ` — _${d.displayValue}_` : ""}`);
      }
      lines.push("");
    }

    if (r.axe.violations.length > 0) {
      lines.push(`### a11y violations`);
      lines.push("");
      for (const v of r.axe.violations) {
        lines.push(`- **[${v.impact ?? "?"}] ${v.id}** — ${v.help} ([docs](${v.helpUrl}))`);
        for (const sel of v.nodes.slice(0, 3)) {
          lines.push(`  - \`${sel}\``);
        }
        if (v.nodes.length > 3) lines.push(`  - …and ${v.nodes.length - 3} more`);
      }
      lines.push("");
    }

    if (r.consoleErrors.length > 0 || r.pageErrors.length > 0) {
      lines.push(`### Runtime errors`);
      lines.push("");
      for (const e of r.pageErrors) lines.push(`- _pageerror_: \`${e}\``);
      for (const e of r.consoleErrors) lines.push(`- _console.error_: \`${e}\``);
      lines.push("");
    }

    if (r.networkErrors.length > 0) {
      lines.push(`### Network errors`);
      lines.push("");
      for (const n of r.networkErrors) {
        lines.push(`- \`${n.status} ${n.method} ${n.url}\``);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
  ensureDirs();

  console.log(`⚙ Preset: ${MOBILE ? "mobile" : "desktop"} · ${ROUTES.length} routes`);

  const results: AuditResult[] = [];

  for (const route of ROUTES) {
    process.stdout.write(`🔍 ${route} ... `);
    try {
      const result = await auditRoute(route);
      results.push(result);
      console.log(
        `perf=${result.lighthouse.performance} ` +
          `a11y=${result.lighthouse.accessibility} ` +
          `axe=${result.axe.violationsCount}`,
      );
    } catch (error) {
      console.error(`❌ ${(error as Error).message}`);
    }
  }

  fs.writeFileSync(
    path.join(OUT, "report.json"),
    JSON.stringify(results, null, 2),
  );
  fs.writeFileSync(path.join(OUT, "report.md"), renderMarkdown(results));

  // Console summary — extra detail compared to before.
  console.log("");
  console.table(
    results.map((r) => ({
      Route: r.route,
      Perf: r.lighthouse.performance,
      A11y: r.lighthouse.accessibility,
      SEO: r.lighthouse.seo,
      BP: r.lighthouse.bestPractices,
      LCP: r.lighthouse.metrics.largestContentfulPaint.displayValue ?? "—",
      TBT: r.lighthouse.metrics.totalBlockingTime.displayValue ?? "—",
      CLS: r.lighthouse.metrics.cumulativeLayoutShift.displayValue ?? "—",
      Axe: r.axe.violationsCount,
      Errs: r.consoleErrors.length + r.pageErrors.length + r.networkErrors.length,
      "KB": Math.round(r.resources.totalBytes / 1024),
    })),
  );

  console.log("");
  console.log(`✅ Summary:    ${OUT}/report.json`);
  console.log(`✅ Markdown:   ${OUT}/report.md`);
  console.log(`✅ LH reports: ${OUT_LIGHTHOUSE}/<slug>.report.html`);
  console.log(`✅ axe raw:    ${OUT_AXE}/<slug>.json`);
  console.log(`✅ Shots:      ${OUT_SCREENSHOTS}/<slug>.png`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
