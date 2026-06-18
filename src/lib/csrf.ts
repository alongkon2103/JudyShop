/**
 * Origin-header CSRF defence for state-changing JSON endpoints.
 *
 * Server Actions are already protected by Next.js (it checks the Origin
 * header against the host automatically). Plain `route.ts` handlers
 * aren't — anyone can POST a JSON body cross-origin, which is enough to
 * trigger logout-CSRF, login-CSRF (logging the victim into the
 * attacker's account), or to abuse any other state-changing route.
 *
 * Strategy:
 *   - In production: reject any POST whose Origin header is missing or
 *     doesn't match `SITE_URL`. Browsers attach Origin to all CORS
 *     fetches and to all same-origin POSTs from forms with non-simple
 *     content types, so a missing Origin on a JSON POST is suspicious.
 *   - In development: relaxed — accept anything so localhost / curl
 *     workflows aren't broken.
 *
 * Returns `null` when the request is allowed, or a 403 NextResponse to
 * return immediately when it's not.
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "./env";

export function checkOrigin(req: NextRequest): NextResponse | null {
  // Skip in dev so localhost POSTs from non-browser clients still work.
  if (process.env.NODE_ENV !== "production") return null;

  const origin = req.headers.get("origin");
  if (!origin) {
    return NextResponse.json(
      { error: "Missing Origin header." },
      { status: 403 },
    );
  }

  let allowed: string;
  try {
    allowed = new URL(env.SITE_URL).host;
  } catch {
    return NextResponse.json(
      { error: "Server origin not configured." },
      { status: 500 },
    );
  }

  let got: string;
  try {
    got = new URL(origin).host;
  } catch {
    return NextResponse.json(
      { error: "Malformed Origin header." },
      { status: 403 },
    );
  }

  if (got !== allowed) {
    return NextResponse.json(
      { error: "Forbidden origin." },
      { status: 403 },
    );
  }
  return null;
}
