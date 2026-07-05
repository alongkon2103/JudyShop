"use client";

import Link from "next/link";
import { Menu, X, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

/**
 * Partner portal top bar. Mirrors AdminTopBar but the logo links to
 * /partner, the pill reads "Partner", and there's no "View site" / admin
 * shortcut. Logout reuses the shared /api/admin/logout endpoint and the
 * shared /admin/login door.
 */
export function PartnerTopBar({
  name,
  drawerOpen,
  onToggleDrawer,
}: {
  name: string;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}) {
  const router = useRouter();

  const onLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <header className="admin-surface sticky top-0 z-30 border-b border-line-dark-2">
      <div className="flex h-14 items-center gap-3 px-4">
        <button
          type="button"
          onClick={onToggleDrawer}
          aria-label={drawerOpen ? "Close menu" : "Open menu"}
          className="grid h-9 w-9 place-items-center rounded-md text-fg-dark transition-colors hover:bg-bg-800 lg:hidden"
        >
          {drawerOpen ? <X size={18} strokeWidth={2.25} /> : <Menu size={18} strokeWidth={2.25} />}
        </button>

        <Link href="/partner" className="flex items-center gap-2 truncate">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-pink-500 font-sans text-[11px] font-extrabold text-white">
            JS
          </span>
          <span className="font-sans text-[14px] font-extrabold tracking-tight text-fg-dark">
            Judy Shop
          </span>
          <span className="rounded-sm bg-pink-500/15 px-1.5 py-0.5 font-sans text-[9px] font-extrabold uppercase tracking-[0.18em] text-pink-500">
            Partner
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden truncate font-sans text-[12px] font-medium text-fg-dark-soft sm:inline">
            {name}
          </span>
          <ThemeToggle className="!h-9 !w-9" />
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-dark-2 px-3 font-sans text-[11px] font-extrabold uppercase tracking-[0.12em] text-fg-dark-soft transition-colors hover:bg-bg-800 hover:text-fg-dark"
          >
            <LogOut size={12} strokeWidth={2.5} /> Logout
          </button>
        </div>
      </div>
    </header>
  );
}
