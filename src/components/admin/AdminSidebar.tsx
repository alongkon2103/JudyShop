"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ScrollText,
  Megaphone,
  Newspaper,
  Receipt,
  Settings,
  History,
  Users,
  UserCog,
  TrendingUp,
  BarChart3,
  PlayCircle,
  Gavel,
} from "lucide-react";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: typeof Package };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { href: "/admin",           label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    section: "Catalogue",
    items: [{ href: "/admin/products", label: "Products", icon: Package }],
  },
  {
    section: "Operations",
    items: [
      { href: "/admin/whitelist",     label: "Whitelist",     icon: ScrollText },
      { href: "/admin/transactions",  label: "Transactions",  icon: Receipt },
      { href: "/admin/partners",      label: "Partners",      icon: Users },
      { href: "/admin/finance",       label: "Finance",       icon: TrendingUp },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/news",          label: "News",          icon: Newspaper },
      { href: "/admin/how-to-use",    label: "How to use",    icon: PlayCircle },
      { href: "/admin/rules",         label: "Rules",         icon: Gavel },
    ],
  },
  {
    section: "System",
    items: [
      { href: "/admin/admins",   label: "Admins",    icon: UserCog },
      { href: "/admin/audit",    label: "Audit log", icon: History },
      { href: "/admin/settings", label: "Settings",  icon: Settings },
    ],
  },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="flex h-full flex-col gap-5 p-4">
      {NAV.map((group) => (
        <div key={group.section}>
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-dark-mute">
            {group.section}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
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
      ))}
    </nav>
  );
}
