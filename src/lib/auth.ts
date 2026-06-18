/**
 * Admin auth — JWT-in-cookie session.
 *
 * Pure JS: `jose` and `bcryptjs` both work in the Edge runtime, so
 * the verifier can be called from `middleware.ts`. Prisma calls
 * stay in Node-runtime route handlers / server actions.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { env } from "./env";

/**
 * `__Host-` prefix hardens the cookie:
 *   - browser refuses to set it without `Secure`
 *   - browser refuses to set it with a `Domain` attribute (no subdomain leakage)
 *   - browser only accepts it for `Path=/`
 * Both conditions are already true above. In dev (http://localhost) the
 * prefix is silently dropped because Secure can't be honoured, so we
 * fall back to the plain name there.
 */
const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-judyshop_admin_session"
    : "judyshop_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours
const JWT_ISSUER = "judyshop-admin";
const JWT_AUDIENCE = "judyshop-admin";

export type AdminSession = {
  sub: string;        // AdminUser.id
  email: string;
  /** Token version this JWT was minted with. Compared to the DB row's
   *  current `tokenVersion` in `requireAdmin()` — a mismatch means the
   *  admin logged out (or rotated their password) since this token was
   *  issued, and any stolen copy of this cookie should be treated as
   *  revoked. Edge middleware can't reach Prisma, so it only checks
   *  the signature; the DB-backed revocation check runs Node-side. */
  tv: number;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.ADMIN_SESSION_SECRET);
}

// ── JWT ─────────────────────────────────────────────────────

export async function signSession(payload: AdminSession): Promise<string> {
  return new SignJWT({ email: payload.email, tv: payload.tv } as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.tv !== "number"
    ) {
      return null;
    }
    return { sub: payload.sub, email: payload.email, tv: payload.tv };
  } catch {
    return null;
  }
}

// ── Cookie helpers ──────────────────────────────────────────

export const SESSION_COOKIE = {
  name: COOKIE_NAME,
  maxAge: SESSION_TTL_SECONDS,
} as const;

export type CookieOptions = {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

export function buildSessionCookie(token: string): CookieOptions {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function buildClearCookie(): CookieOptions {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}

// ── Password helpers ────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
