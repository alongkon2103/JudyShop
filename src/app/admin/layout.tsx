import { Inter } from "next/font/google";
import { getAdminSession } from "@/lib/admin-session";
import { AdminShell } from "./AdminShell";

// Inter — used exclusively inside /admin (scoped via .admin-canvas).
// Loaded here (not in the root layout) so public pages don't pay for it.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Admin layout — full-bleed, minimal chrome.
 * - When NOT authenticated (login page): no shell, no sidebar.
 * - When authenticated: top bar + persistent sidebar + main.
 */
/**
 * Auth model is two-layer:
 *   1. `middleware.ts` rejects any /admin request without a valid JWT
 *      signature, redirecting to /admin/login.
 *   2. Every admin server component / server action / API route calls
 *      `requireAdmin()` which DB-checks `isActive` + `tokenVersion`.
 *
 * The layout uses `getAdminSession()` (JWT-only, no DB hit) just to
 * display the email — a revoked token will briefly render the shell
 * before the inner page's `requireAdmin()` redirects, which is
 * acceptable. We don't enforce here because (a) we'd need to know
 * whether we're on /admin/login and Next.js doesn't surface that
 * reliably from a layout, and (b) middleware already gates this.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (!session) {
    return <div className={`admin-canvas ${inter.variable}`}>{children}</div>;
  }

  return (
    <div className={inter.variable}>
      <AdminShell email={session.email}>{children}</AdminShell>
    </div>
  );
}
