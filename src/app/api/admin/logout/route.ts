import { NextResponse, type NextRequest } from "next/server";
import { buildClearCookie } from "@/lib/auth";
import { getAdminSession } from "@/lib/admin-session";
import { checkOrigin } from "@/lib/csrf";
import { clientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const originBlock = checkOrigin(req);
  if (originBlock) return originBlock;

  // Bump tokenVersion so every JWT minted for this admin — including
  // stolen copies on other devices — is rejected by `requireAdmin()`
  // from this point forward. Best-effort: if the user is already
  // unauthenticated or the DB write fails, we still clear the cookie.
  const session = await getAdminSession();
  if (session) {
    try {
      await db.adminUser.update({
        where: { id: session.sub },
        data: { tokenVersion: { increment: 1 } },
      });
    } catch {
      // Swallow — clearing the cookie is the user-visible part.
    }
    try {
      await db.auditLog.create({
        data: {
          actorId:    session.sub,
          actorEmail: session.email,
          action:     "admin.logout",
          ip:         clientIp(req),
        },
      });
    } catch (err) {
      console.error("[logout-audit] failed", err);
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(buildClearCookie());
  return res;
}
