"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { PartnerTopBar } from "@/components/partner/PartnerTopBar";
import { PartnerSidebar } from "@/components/partner/PartnerSidebar";
import { ToastProvider } from "@/components/admin/toast/ToastContext";
import { Toaster } from "@/components/admin/toast/Toaster";
import { cn } from "@/lib/cn";

/**
 * Partner portal shell — same chrome/layout as AdminShell (reuses the
 * `.admin-canvas` theme, toast stack, and mobile drawer) but wired to the
 * partner top bar + sidebar so no admin navigation is ever rendered.
 */
export function PartnerShell({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <ToastProvider>
      <div className="admin-canvas">
        <PartnerTopBar
          name={name}
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((v) => !v)}
        />

        <div className="flex">
          {/* Desktop sidebar — persistent */}
          <aside className="admin-surface hidden w-[240px] shrink-0 border-r border-line-dark-2 lg:block">
            <div className="sticky top-14 h-[calc(100svh-3.5rem)] overflow-y-auto">
              <PartnerSidebar />
            </div>
          </aside>

          {/* Mobile drawer */}
          <div
            className={cn(
              "fixed inset-0 z-40 lg:hidden",
              drawerOpen ? "pointer-events-auto" : "pointer-events-none",
            )}
            aria-hidden={!drawerOpen}
          >
            <div
              onClick={() => setDrawerOpen(false)}
              className={cn(
                "absolute inset-0 bg-black/55 transition-opacity",
                drawerOpen ? "opacity-100" : "opacity-0",
              )}
            />
            <aside
              className={cn(
                "admin-surface absolute inset-y-0 left-0 w-[260px] border-r border-line-dark-2 shadow-xl transition-transform",
                drawerOpen ? "translate-x-0" : "-translate-x-full",
              )}
            >
              <div className="h-14 border-b border-line-dark-2" />
              <div className="h-[calc(100svh-3.5rem)] overflow-y-auto">
                <PartnerSidebar onNavigate={() => setDrawerOpen(false)} />
              </div>
            </aside>
          </div>

          <main key={pathname} className="anim-fade-up min-w-0 flex-1 p-4 sm:p-6">
            {children}
          </main>
        </div>

        <Toaster />
      </div>
    </ToastProvider>
  );
}
