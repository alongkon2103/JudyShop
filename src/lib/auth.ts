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

/** Access level baked into the session JWT so edge middleware can gate
 *  by role without a DB hit. Mirrors Prisma's `UserRole` enum as a plain
 *  string union to keep this module edge-safe (no @prisma/client import). */
export type Role = "ADMIN" | "PARTNER";

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
  /** ADMIN → /admin back-office; PARTNER → /partner portal. Gated in
   *  middleware (signature-only) and re-checked against the DB row in
   *  requireAdmin()/requirePartner(). */
  role: Role;
  /** Partner this login represents. Non-null only for PARTNER sessions;
   *  always null for ADMIN. Scopes every /partner query. */
  partnerId: string | null;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.ADMIN_SESSION_SECRET);
}

// ── JWT ─────────────────────────────────────────────────────

export async function signSession(payload: AdminSession): Promise<string> {
  return new SignJWT({
    email: payload.email,
    tv: payload.tv,
    role: payload.role,
    pid: payload.partnerId,
  } as JWTPayload)
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
    // Role/partnerId were added later — a token minted before this change
    // (or tampered) won't carry a valid role, so we reject it and force a
    // fresh login rather than silently guessing a privilege level.
    const role = payload.role;
    if (role !== "ADMIN" && role !== "PARTNER") return null;
    const pid = payload.pid;
    if (pid !== null && typeof pid !== "string") return null;

    return {
      sub: payload.sub,
      email: payload.email,
      tv: payload.tv,
      role,
      partnerId: pid,
    };
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
