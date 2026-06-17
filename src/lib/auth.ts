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

const COOKIE_NAME = "judyshop_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export type AdminSession = {
  sub: string;        // AdminUser.id
  email: string;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.ADMIN_SESSION_SECRET);
}

// ── JWT ─────────────────────────────────────────────────────

export async function signSession(payload: AdminSession): Promise<string> {
  return new SignJWT({ ...payload } as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return { sub: payload.sub, email: payload.email };
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
