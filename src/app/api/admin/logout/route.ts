import { NextResponse } from "next/server";
import { buildClearCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(buildClearCookie());
  return res;
}
