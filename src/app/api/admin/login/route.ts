import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  buildSessionCookie,
  signSession,
  verifyPassword,
} from "@/lib/auth";
import { clientIp, hit, reset, retryAfterSeconds } from "@/lib/rate-limit";
import { checkOrigin } from "@/lib/csrf";

export const runtime = "nodejs";

const LoginInput = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

// Brute-force throttle.
//   - Per-IP: 5 attempts / 15 min — broad lane, blocks single-IP scripts.
//   - Per-email: 3 attempts / 3 hours — hard lockout per account, defends
//     against distributed (botnet) attempts that spread IP load thin.
// The 3-hour email window is intentionally aggressive: a real admin who
// fat-fingers 3 times in a row must wait it out or contact ops. Worth
// the friction because admin compromise is the worst-case outcome here.
const IP_WINDOW_MS    = 15 * 60 * 1000;
const IP_LIMIT        = 5;
const EMAIL_WINDOW_MS = 3 * 60 * 60 * 1000;
const EMAIL_LIMIT     = 3;

function tooMany(resetIn: number) {
  const retryAfter = retryAfterSeconds(resetIn);
  return NextResponse.json(
    { error: "Too many attempts. Please try again later.", retryAfterSec: retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/**
 * Write a login outcome row to AuditLog directly (bypassing the
 * `logAdmin` helper because that one assumes a valid session already
 * exists). Wrapped in try/catch — a logging failure must never block
 * a login response.
 */
async function logLoginAttempt(args: {
  emailKey: string;
  ip: string;
  success: boolean;
  reason?: "not_found" | "inactive" | "bad_password";
  userId?: string;
}) {
  try {
    await db.auditLog.create({
      data: {
        actorId:    args.userId ?? null,
        actorEmail: args.emailKey,
        action:     args.success ? "admin.login.success" : "admin.login.failure",
        ip:         args.ip,
        payload:    args.success
          ? undefined
          : { reason: args.reason ?? "unknown" },
      },
    });
  } catch (err) {
    console.error("[login-audit] failed", err);
  }
}

export async function POST(req: NextRequest) {
  const originBlock = checkOrigin(req);
  if (originBlock) return originBlock;

  const ip = clientIp(req);

  // Pre-check the IP bucket *before* parsing the body so an attacker
  // can't burn CPU on bcrypt by spraying invalid payloads.
  const ipCheck = hit(`login:ip:${ip}`, { limit: IP_LIMIT, windowMs: IP_WINDOW_MS });
  if (!ipCheck.ok) return tooMany(ipCheck.resetIn);

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = LoginInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { password } = parsed.data;
  // Canonical email for both DB lookup and rate-limit bucket. Without
  // this, `Admin@x.com` vs `admin@x.com` hit different DB rows but the
  // same lowercase rate-limit bucket — making the per-email throttle
  // bypassable via casing tricks.
  const emailKey = parsed.data.email.trim().toLowerCase();

  // Per-email bucket — defends against distributed (botnet) attempts
  // that spread the IP load thin.
  const emailCheck = hit(`login:email:${emailKey}`, {
    limit: EMAIL_LIMIT,
    windowMs: EMAIL_WINDOW_MS,
  });
  if (!emailCheck.ok) return tooMany(emailCheck.resetIn);

  // Look up by canonical email. We use `findFirst` with `mode: "insensitive"`
  // so admins created with any casing (e.g. `Admin@x.com` via the CLI)
  // still resolve to the same row.
  const user = await db.adminUser.findFirst({
    where: { email: { equals: emailKey, mode: "insensitive" } },
  });

  // Use the dummy hash for BOTH "user doesn't exist" AND "user is
  // deactivated". This keeps the bcrypt timing identical between
  // those two paths so an attacker can't enumerate which admin
  // emails are still active.
  const hash =
    user && user.isActive
      ? user.passwordHash
      : "$2a$12$invalidinvalidinvalidinvalidinvali";
  const ok = await verifyPassword(password, hash);

  if (!user || !user.isActive || !ok) {
    const reason: "not_found" | "inactive" | "bad_password" =
      !user ? "not_found" : !user.isActive ? "inactive" : "bad_password";
    await logLoginAttempt({ emailKey, ip, success: false, reason });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Successful auth — clear the rate counters so a real admin who
  // mistyped a few times doesn't stay locked out.
  reset(`login:ip:${ip}`);
  reset(`login:email:${emailKey}`);

  await db.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await logLoginAttempt({ emailKey, ip, success: true, userId: user.id });

  const token = await signSession({ sub: user.id, email: user.email, tv: user.tokenVersion });
  const cookie = buildSessionCookie(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie);
  return res;
}
