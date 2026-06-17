import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { getMonthlyFinance, parseMonthKey } from "@/lib/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /admin/finance/export/csv?month=YYYY-MM
 *
 * One CSV with two stacked sections — per-game lines (with the
 * shared-pool row at the bottom of each game) followed by a
 * per-partner aggregate. Section headers are bare strings so Excel /
 * Google Sheets just treats them as plain rows; admin can split into
 * separate sheets manually if needed.
 *
 * Numbers are written without the ฿ glyph so spreadsheets parse them
 * as numbers (not text). Strings are escaped via `csvCell()`.
 */
export async function GET(req: NextRequest) {
  await requireAdmin();

  const { year, month } = parseMonthKey(req.nextUrl.searchParams.get("month"));
  const data = await getMonthlyFinance(year, month);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const rows: string[] = [];

  // ── Summary ─────────────────────────────────────────────────────
  rows.push(`Finance Statement,${monthKey}`);
  rows.push("");
  rows.push("Section,Label,Value");
  rows.push(`Summary,Total Gross,${data.totals.gross.toFixed(2)}`);
  rows.push(`Summary,Partner Payout,${data.totals.partnerPayout.toFixed(2)}`);
  rows.push(`Summary,Shared Pool,${data.totals.sharedPool.toFixed(2)}`);
  rows.push(`Summary,Order Count,${data.totals.orderCount}`);
  rows.push("");

  // ── Per Game ────────────────────────────────────────────────────
  rows.push("Per Game");
  rows.push("Game,Recipient,Contact,SharePercent,Payout");
  for (const game of data.perGame) {
    for (const line of game.lines) {
      rows.push(
        [
          csvCell(game.name),
          csvCell(line.name),
          csvCell(line.contact ?? ""),
          line.sharePercent.toFixed(2),
          line.payout.toFixed(2),
        ].join(","),
      );
    }
  }
  rows.push("");

  // ── Per Partner ─────────────────────────────────────────────────
  rows.push("Per Partner");
  rows.push("Partner,Contact,Games,Orders,AvgPerOrder,Payout");
  for (const p of data.perPartner) {
    rows.push(
      [
        csvCell(p.name),
        csvCell(p.contact ?? ""),
        p.gameCount,
        p.orderCount,
        p.avgPerOrder.toFixed(2),
        p.payout.toFixed(2),
      ].join(","),
    );
  }
  if (data.totals.sharedPool > 0) {
    rows.push(
      [csvCell("เงินกลาง"), "", "", "", "", data.totals.sharedPool.toFixed(2)].join(","),
    );
  }

  const csv = rows.join("\n");
  // UTF-8 BOM so Excel opens Thai characters correctly.
  const body = "﻿" + csv;

  return new NextResponse(body, {
    headers: {
      "content-type":        "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="finance_${monthKey}_judygamestudio.csv"`,
      "cache-control":       "no-store",
    },
  });
}

/** Quote a value that may contain commas / quotes / newlines. */
function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
