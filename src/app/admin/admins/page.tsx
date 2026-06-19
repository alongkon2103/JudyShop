import type { Metadata } from "next";
import { UserCog } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { NewAdminForm } from "./NewAdminForm";
import { EditAdminButton } from "./EditAdminButton";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { ForceLogoutButton } from "./ForceLogoutButton";
import { ForceLogoutAllButton } from "./ForceLogoutAllButton";

export const metadata: Metadata = { title: "Admins" };

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminsPage() {
  const session = await requireAdmin();

  const admins = await db.adminUser.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  const activeCount = admins.filter((a) => a.isActive).length;

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="System"
        title="Admins"
        subtitle={`คนที่เข้า admin panel ได้ — ${activeCount} active / ${admins.length} total`}
      />

      <div className="panel rounded-xl p-4 sm:p-5">
        <h2 className="mb-3 text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
          Add admin
        </h2>
        <NewAdminForm />
      </div>

      {admins.length === 0 ? (
        <EmptyState
          icon={<UserCog size={20} />}
          title="ยังไม่มี Admin"
          description="(ไม่น่าจะเกิดขึ้น — คุณ login เข้าหน้านี้อยู่)"
        />
      ) : (
        <div className="panel overflow-hidden rounded-xl">
          <div className="flex items-center justify-between gap-3 border-b border-line-light bg-paper-2/40 px-4 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
              All admins
            </p>
            <ForceLogoutAllButton />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
              <thead className="border-b border-line-light bg-paper-2/40 text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Email · Name</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Last login</th>
                  <th className="px-4 py-2.5 font-semibold">Created</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light text-fg-light">
                {admins.map((a) => {
                  const isSelf = a.id === session.sub;
                  return (
                    <tr key={a.id} className="align-middle hover:bg-paper-2/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-[13px] font-semibold text-fg-light">
                            {a.email}
                          </p>
                          {isSelf && (
                            <span className="rounded-full bg-paper-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fg-light-soft">
                              You
                            </span>
                          )}
                        </div>
                        {a.name && (
                          <p className="text-[11px] text-fg-light-soft">{a.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={a.isActive ? "ok" : "muted"}>
                          {a.isActive ? "Active" : "Disabled"}
                        </StatusBadge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12px] text-fg-light-soft">
                        {fmtDate(a.lastLoginAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12px] text-fg-light-mute">
                        {fmtDate(a.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <EditAdminButton
                            id={a.id}
                            email={a.email}
                            name={a.name}
                            isActive={a.isActive}
                            isSelf={isSelf}
                          />
                          <ResetPasswordButton
                            id={a.id}
                            email={a.email}
                            isSelf={isSelf}
                          />
                          {!isSelf && (
                            <ForceLogoutButton id={a.id} email={a.email} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
