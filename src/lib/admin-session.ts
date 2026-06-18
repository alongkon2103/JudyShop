/**
 * Server-side helpers for reading the current admin session from
 * server components, server actions, and route handlers.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type AdminSession } from "./auth";
import { db } from "./db";

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = cookies().get(SESSION_COOKIE.name)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Guarantees a live session: JWT signature is valid AND the DB row
 * still matches (active + same tokenVersion). The DB hit is what
 * makes "logout actually revokes everything" possible — edge
 * middleware can only verify the signature, but every page / server
 * action / API route on the admin surface calls this, so a revoked
 * cookie is caught within one request after logout.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const user = await db.adminUser.findUnique({
    where: { id: session.sub },
    select: { isActive: true, tokenVersion: true },
  });
  if (!user || !user.isActive || user.tokenVersion !== session.tv) {
    redirect("/admin/login");
  }

  return session;
}
