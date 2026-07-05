/**
 * Server-side helpers for reading the current admin session from
 * server components, server actions, and route handlers.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type AdminSession } from "./auth";
import { db } from "./db";

/** A guaranteed-PARTNER session: same as AdminSession but `partnerId` is
 *  narrowed to a non-null string, so downstream /partner queries can use
 *  it directly as the scoping key without another null check. */
export type PartnerSession = AdminSession & { partnerId: string };

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
    select: { isActive: true, tokenVersion: true, role: true },
  });
  if (!user || !user.isActive || user.tokenVersion !== session.tv) {
    redirect("/admin/login");
  }
  // Role is re-read from the DB (not trusted from the JWT) so a partner
  // who was just promoted/demoted is gated on current truth. A PARTNER
  // that lands on an /admin page is sent to their own portal, not the
  // login screen — they're authenticated, just not authorised here.
  if (user.role !== "ADMIN") redirect("/partner");

  return session;
}

/**
 * Partner-portal counterpart of requireAdmin(). Guarantees a live
 * PARTNER session (valid JWT + active row + matching tokenVersion +
 * role PARTNER + a linked partnerId) and returns it with `partnerId`
 * narrowed to a non-null string. ADMINs are bounced to /admin; missing
 * or misconfigured sessions to /admin/login.
 */
export async function requirePartner(): Promise<PartnerSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const user = await db.adminUser.findUnique({
    where: { id: session.sub },
    select: { isActive: true, tokenVersion: true, role: true, partnerId: true },
  });
  if (!user || !user.isActive || user.tokenVersion !== session.tv) {
    redirect("/admin/login");
  }
  if (user.role !== "PARTNER") redirect("/admin");
  // A PARTNER with no linked Partner has nothing it may see — fail
  // closed rather than showing an empty or (worse) unscoped portal.
  if (!user.partnerId) redirect("/admin/login");

  return { ...session, partnerId: user.partnerId };
}
