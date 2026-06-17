import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Combined edge middleware.
 *  - /admin & /api/admin → JWT session gate (redirect to /admin/login when missing).
 *  - everything else under the matcher → next-intl locale resolution for the public site.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Admin auth gate ──────────────────────────────────────────
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const isLoginPage = pathname === "/admin/login";
    const isLoginApi  = pathname === "/api/admin/login";
    if (isLoginPage || isLoginApi) return NextResponse.next();

    const token = req.cookies.get(SESSION_COOKIE.name)?.value;
    const session = token ? await verifySession(token) : null;
    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
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
