import { Inter } from "next/font/google";
import { requirePartner } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { PartnerShell } from "@/components/partner/PartnerShell";

// Same Inter font the admin surface uses, scoped here via .admin-canvas.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Partner portal layout.
 *
 * `requirePartner()` is the gate: it guarantees a live session whose role
 * is PARTNER with a linked partnerId, redirecting admins to /admin and
 * everyone else to /admin/login. Every partner page also calls it (they
 * need the partnerId to scope their queries), so this is defense in depth
 * on top of the edge middleware.
 */
export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePartner();
  const partner = await db.partner.findUnique({
    where: { id: session.partnerId },
    select: { name: true },
  });

  return (
    <div className={inter.variable}>
      <PartnerShell name={partner?.name ?? session.email}>{children}</PartnerShell>
    </div>
  );
}
