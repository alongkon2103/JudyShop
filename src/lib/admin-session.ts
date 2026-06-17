/**
 * Server-side helpers for reading the current admin session from
 * server components, server actions, and route handlers.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type AdminSession } from "./auth";

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = cookies().get(SESSION_COOKIE.name)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Use in server components inside /admin to guarantee a session. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}
