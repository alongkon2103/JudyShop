/**
 * Self-contained HTML template for the Finance statement PDF.
 *
 * Why HTML+Chromium and not a React-PDF / pdfkit pipeline?
 *   - The same styling vocabulary as the public site, so the
 *     statement *looks* like Judy Shop without a separate design
 *     system to maintain.
 *   - Thai font support is just "use Noto Sans Thai from Google
 *     Fonts" rather than wrestling with TTF embedding.
 *   - Playwright is already a dev dep (used by the manual builder),
 *     so we reuse the toolchain.
 *
 * The route handler that imports this just hands it Playwright;
 * everything below is plain HTML/CSS rendering on top of a
 * MonthlyFinance snapshot.
 */
import { fmtTHB, type MonthlyFinance } from "./finance";

const MONTH_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderFinancePdfHtml(
  data: MonthlyFinance,
  opts: { year: number; month: number; generatedAt: Date },
): string {
  const { year, month, generatedAt } = opts;
  const monthLabel = `${MONTH_TH[month - 1]} ${year}`;
  const generatedStr = generatedAt.toLocaleString("th-TH-u-ca-gregory", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const perGameHtml = data.perGame
    .map(
      (g) => `
    <section class="game">
      <header class="game-head">
        <h3>${escape(g.name)}</h3>
        <span class="game-total">${escape(fmtTHB(g.gross))}</span>
      </header>
      <p class="game-meta">
        ${g.orderCount} orders · เฉลี่ย ${escape(fmtTHB(g.avgPerOrder))} ต่อออเดอร์
      </p>
      <table class="lines">
        <thead>
          <tr>
            <th>ผู้รับ</th><th>Contact</th>
            <th class="num">Share</th><th class="num">Payout</th>
          </tr>
        </thead>
        <tbody>
          ${g.lines
            .map(
              (l) => `
          <tr class="${l.partnerId === null ? "pool" : ""}">
            <td>${l.partnerId === null ? "<em>— เงินกลาง —</em>" : escape(l.name)}</td>
            <td>${escape(l.contact ?? "—")}</td>
            <td class="num">${l.sharePercent.toFixed(2)}%</td>
            <td class="num bold">${escape(fmtTHB(l.payout))}</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </section>`,
    )
    .join("");

  const perPartnerHtml = data.perPartner.length
    ? `
    <h2>สรุปต่อ Partner</h2>
    <table class="aggregate">
      <thead>
        <tr>
          <th>Partner</th><th>Contact</th>
          <th class="num">Games</th><th class="num">Orders</th>
          <th class="num">เฉลี่ย/ออเดอร์</th><th class="num">Payout</th>
        </tr>
      </thead>
      <tbody>
        ${data.perPartner
          .map(
            (p) => `
        <tr>
          <td class="bold">${escape(p.name)}</td>
          <td>${escape(p.contact ?? "—")}</td>
          <td class="num">${p.gameCount}</td>
          <td class="num">${p.orderCount}</td>
          <td class="num">${escape(fmtTHB(p.avgPerOrder))}</td>
          <td class="num bold pink">${escape(fmtTHB(p.payout))}</td>
        </tr>`,
          )
          .join("")}
        ${
          data.totals.sharedPool > 0
            ? `
        <tr class="pool">
          <td><em>— เงินกลาง —</em></td>
          <td>—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td>
          <td class="num bold">${escape(fmtTHB(data.totals.sharedPool))}</td>
        </tr>`
            : ""
        }
      </tbody>
    </table>`
    : "";

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>Finance Statement · ${monthLabel}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&family=Noto+Sans+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --pink:      #d63384;
    --pink-deep: #a82166;
    --ink:       #1a1a1a;
    --ink-soft:  #444;
    --ink-mute:  #767676;
    --border:    #d9d9d9;
    --border-2:  #ececec;
    --bg-soft:   #faf7f8;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: "Noto Sans Thai", "Sarabun", "Helvetica Neue", Arial, sans-serif;
    color: var(--ink);
    font-size: 10.5pt;
    line-height: 1.6;
  }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .bold { font-weight: 700; }
  .pink { color: var(--pink); }
  em { font-style: normal; color: var(--ink-mute); }

  header.cover {
    padding: 30pt 0 18pt;
    border-bottom: 3pt solid var(--pink);
    margin-bottom: 18pt;
  }
  header.cover .kicker {
    text-transform: uppercase; letter-spacing: 0.18em;
    font-size: 9pt; color: var(--pink); font-weight: 700;
  }
  header.cover h1 {
    margin: 6pt 0 4pt; font-size: 26pt; color: var(--ink);
  }
  header.cover .month {
    font-size: 14pt; color: var(--ink-soft);
  }

  h2 {
    font-size: 14pt;
    margin: 22pt 0 8pt;
    padding-bottom: 4pt;
    border-bottom: 2pt solid var(--pink);
    color: var(--ink);
    page-break-after: avoid;
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8pt;
    margin: 12pt 0 18pt;
  }
  .kpi {
    border: 1pt solid var(--border);
    border-radius: 4pt;
    padding: 10pt 12pt;
    background: var(--bg-soft);
  }
  .kpi .label {
    font-size: 8.5pt; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--ink-mute); font-weight: 700;
  }
  .kpi .value {
    margin-top: 2pt; font-size: 14pt; font-weight: 700; color: var(--ink);
  }
  .kpi.pink .value { color: var(--pink); }

  section.game {
    margin: 12pt 0 16pt;
    border: 1pt solid var(--border);
    border-radius: 4pt;
    overflow: hidden;
    page-break-inside: avoid;
  }
  section.game .game-head {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 10pt 12pt;
    background: var(--bg-soft);
    border-bottom: 1pt solid var(--border);
  }
  section.game h3 {
    margin: 0; font-size: 13pt; color: var(--ink);
  }
  section.game .game-total {
    font-size: 16pt; font-weight: 700; color: var(--pink);
  }
  section.game .game-meta {
    margin: 6pt 12pt 0; color: var(--ink-mute); font-size: 9.5pt;
  }

  table {
    width: 100%; border-collapse: collapse;
    margin-top: 6pt;
    font-size: 10pt;
  }
  table th, table td {
    padding: 6pt 9pt;
    text-align: left;
    border-bottom: 1pt solid var(--border-2);
    vertical-align: top;
  }
  table th {
    background: #fafafa; font-size: 8.5pt;
    text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--ink-soft); font-weight: 700;
  }
  table tbody tr.pool td {
    background: var(--bg-soft);
  }
  table tbody tr:last-child td { border-bottom: 0; }

  footer.gen {
    margin-top: 30pt;
    border-top: 1pt solid var(--border);
    padding-top: 8pt;
    font-size: 8.5pt; color: var(--ink-mute);
    display: flex; justify-content: space-between;
  }

  @page {
    size: A4;
    margin: 18mm 16mm 22mm;
    @bottom-center {
      content: "หน้า " counter(page);
      font-family: "Noto Sans Thai", sans-serif;
      font-size: 9pt;
      color: #767676;
    }
    @top-right {
      content: "Judy Shop · Finance Statement";
      font-family: "Noto Sans Thai", sans-serif;
      font-size: 8.5pt;
      color: #a0a0a0;
    }
  }
</style>
</head>
<body>
  <header class="cover">
    <div class="kicker">Finance Statement</div>
    <h1>Judy Shop</h1>
    <div class="month">รายงานยอดและการแบ่งหุ้นส่วนเดือน ${monthLabel}</div>
  </header>

  <section>
    <h2>สรุปยอดเดือนนี้</h2>
    <div class="summary">
      <div class="kpi"><div class="label">Total Gross</div><div class="value">${escape(fmtTHB(data.totals.gross))}</div></div>
      <div class="kpi pink"><div class="label">Partner Payout</div><div class="value">${escape(fmtTHB(data.totals.partnerPayout))}</div></div>
      <div class="kpi"><div class="label">เงินกลาง</div><div class="value">${escape(fmtTHB(data.totals.sharedPool))}</div></div>
      <div class="kpi"><div class="label">Orders</div><div class="value">${data.totals.orderCount}</div></div>
    </div>
  </section>

  <h2>สรุปต่อเกม</h2>
  ${perGameHtml || '<p style="color:var(--ink-mute)">ไม่มีออเดอร์ที่ชำระเงินในเดือนนี้</p>'}

  ${perPartnerHtml}

  <footer class="gen">
    <span>Generated: ${escape(generatedStr)}</span>
    <span>Judy Shop · judygamestudio.com</span>
  </footer>
</body>
</html>`;
}
