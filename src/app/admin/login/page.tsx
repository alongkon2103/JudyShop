import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { safeNextPath } from "@/lib/redirect";
import { db } from "@/lib/db";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin login" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = safeNextPath(searchParams.next);

  // If already authenticated, skip the form — but only if the token
  // also passes the DB-backed revoke check. Without the DB check, a
  // logged-out cookie (signature still valid, tokenVersion bumped)
  // would loop: login → redirect to /admin → requireAdmin redirects
  // back here → repeat.
  const session = await getAdminSession();
  if (session) {
    const user = await db.adminUser.findUnique({
      where: { id: session.sub },
      select: { isActive: true, tokenVersion: true },
    });
    if (user?.isActive && user.tokenVersion === session.tv) {
      redirect(next);
    }
  }

  return (
    <section className="grid min-h-[80svh] place-items-center py-s5">
      <div className="panel w-full max-w-md rounded-xl p-s5 sm:p-s6">
        <header className="mb-s4 text-center">
          <h1 className="font-display text-[34px] uppercase tracking-wide text-fg-light sm:text-[44px]">
            Admin
          </h1>
          <p className="mt-1 font-sans text-[12px] font-extrabold uppercase tracking-[0.2em] text-fg-light-soft">
            Sign in to continue
          </p>
        </header>
        <LoginForm next={next} />
      </div>
    </section>
  );
}
