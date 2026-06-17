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
