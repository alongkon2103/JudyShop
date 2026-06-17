import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  buildSessionCookie,
  signSession,
  verifyPassword,
} from "@/lib/auth";
import { clientIp, hit, reset, retryAfterSeconds } from "@/lib/rate-limit";

export const runtime = "nodejs";

const LoginInput = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

// Brute-force throttle: 5 failed attempts per IP per 15 minutes,
// and 5 failed attempts per email per 15 minutes (slow lane).
const IP_WINDOW_MS    = 15 * 60 * 1000;
const IP_LIMIT        = 5;
const EMAIL_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_LIMIT     = 5;

function tooMany(resetIn: number) {
  const retryAfter = retryAfterSeconds(resetIn);
  return NextResponse.json(
    { error: "Too many attempts. Please try again later.", retryAfterSec: retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export async function POST(req: NextRequest) {
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
  const { email, password } = parsed.data;
  const emailKey = email.trim().toLowerCase();

  // Per-email bucket — defends against distributed (botnet) attempts
  // that spread the IP load thin.
  const emailCheck = hit(`login:email:${emailKey}`, {
    limit: EMAIL_LIMIT,
    windowMs: EMAIL_WINDOW_MS,
  });
  if (!emailCheck.ok) return tooMany(emailCheck.resetIn);

  const user = await db.adminUser.findUnique({ where: { email } });
  // Compare against a dummy hash when the user doesn't exist so that
  // response time doesn't leak which emails are registered.
  const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvali";
  const ok = await verifyPassword(password, hash);

  if (!user || !user.isActive || !ok) {
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

  const token = await signSession({ sub: user.id, email: user.email });
  const cookie = buildSessionCookie(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie);
  return res;
}
