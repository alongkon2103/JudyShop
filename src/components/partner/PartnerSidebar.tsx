"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, ScrollText } from "lucide-react";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

// Deliberately tiny — a partner only ever sees their own dashboard,
// earnings, and whitelist. No products / admins / settings / other
// partners. (The middleware + requirePartner() enforce this server-side;
// this list is just what's reachable in the UI.)
const NAV: NavItem[] = [
  { href: "/partner",           label: "Dashboard", icon: LayoutDashboard },
  { href: "/partner/finance",   label: "Finance",   icon: TrendingUp },
  { href: "/partner/whitelist", label: "Whitelist", icon: ScrollText },
];

export function PartnerSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/partner" ? pathname === "/partner" : pathname.startsWith(href);

  return (
    <nav className="flex h-full flex-col gap-5 p-4">
      <div>
        <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-dark-mute">
          Partner
        </p>
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium",
                    "transition-colors duration-fast",
                    active
                      ? "bg-pink-500/12 text-pink-400"
                      : "text-fg-dark-soft hover:bg-bg-800 hover:text-fg-dark",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-pink-500"
                    />
                  )}
                  <Icon size={15} strokeWidth={2} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
