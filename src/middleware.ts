import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Combined edge middleware.
 *  - /admin  & /api/admin   → gate: signed-in AND role=ADMIN.
 *  - /partner & /api/partner → gate: signed-in AND role=PARTNER.
 *  - everything else under the matcher → next-intl locale resolution.
 *
 * Both zones share one login (/admin/login) and one session cookie; the
 * `role` claim (verified by signature only here — the DB re-check runs
 * Node-side in requireAdmin/requirePartner) decides which zone a session
 * may enter. A signed-in user who wanders into the wrong zone is bounced
 * to their own home rather than the login screen.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminZone   = pathname.startsWith("/admin")   || pathname.startsWith("/api/admin");
  const isPartnerZone = pathname.startsWith("/partner") || pathname.startsWith("/api/partner");

  // ── Auth gate (both zones) ───────────────────────────────────
  if (isAdminZone || isPartnerZone) {
    // Login is the one door both roles come through; logout is
    // role-agnostic (it only clears the cookie) and is called from the
    // partner top bar too, so it must NOT be blocked by the admin-zone
    // role check below.
    if (
      pathname === "/admin/login" ||
      pathname === "/api/admin/login" ||
      pathname === "/api/admin/logout"
    ) {
      return NextResponse.next();
    }

    const isApi = pathname.startsWith("/api/");
    const token = req.cookies.get(SESSION_COOKIE.name)?.value;
    const session = token ? await verifySession(token) : null;

    // Not signed in → 401 for API, redirect to login for pages.
    if (!session) {
      if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    // Signed in but wrong zone for this role → 403 for API, bounce to
    // their own home for pages.
    const allowed =
      (isAdminZone   && session.role === "ADMIN") ||
      (isPartnerZone && session.role === "PARTNER");
    if (!allowed) {
      if (isApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const url = req.nextUrl.clone();
      url.pathname = session.role === "PARTNER" ? "/partner" : "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // ── Non-admin API routes (webhook, checkwhitelist) — pass through ──
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // ── Public site — defer to next-intl for locale routing ─────
  return intlMiddleware(req);
}

export const config = {
  /**
   * Catch everything except Next internals, static files, and uploads.
   * Both branches above are gated by their own path-prefix checks.
   */
  matcher: ["/((?!_next|favicon|images|uploads|.*\\..*).*)"],
};
