import type { Metadata } from "next";
import { Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { NewPartnerForm } from "./NewPartnerForm";
import { EditPartnerButton } from "./EditPartnerButton";
import { deletePartner } from "./_actions";

export const metadata: Metadata = { title: "Partners" };

/** Adapter so the generic DeleteButton (which expects an action that
 *  throws on failure) can consume our discriminated `PartnerResult`. */
async function deletePartnerOrThrow(id: string): Promise<void> {
  "use server";
  const res = await deletePartner(id);
  if (!res.ok) throw new Error(res.error);
}

export default async function PartnersPage() {
  await requireAdmin();

  const partners = await db.partner.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { shares: true, users: true } },
      users: {
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true, isActive: true },
      },
    },
  });

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="Operations"
        title="Partners"
        subtitle={`รายชื่อหุ้นส่วนของร้าน — total ${partners.length}`}
      />

      <div className="panel rounded-xl p-4 sm:p-5">
        <h2 className="mb-3 text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
          Add partner
        </h2>
        <NewPartnerForm />
      </div>

      {partners.length === 0 ? (
        <EmptyState
          icon={<Users size={20} />}
          title="ยังไม่มี Partner"
          description="เพิ่มหุ้นส่วนคนแรกผ่านฟอร์มด้านบน — แล้วไปจัดสรรเปอร์เซ็นต์ในหน้า Edit Product"
        />
      ) : (
        <div className="panel overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-[13px]">
              <thead className="border-b border-line-light bg-paper-2/40 text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Contact</th>
                  <th className="px-4 py-2.5 font-semibold">Note</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Games</th>
                  <th className="px-4 py-2.5 font-semibold">Login</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light text-fg-light">
                {partners.map((p) => {
                  // A partner can't be deleted while it still owns shares OR
                  // has a login account attached (FK RESTRICT on both). Show
                  // the specific blocker so the admin knows what to clear.
                  const deleteBlock =
                    p._count.shares > 0
                      ? `ถือสิทธิ์อยู่ใน ${p._count.shares} เกม — ลบ share ออกจากทุกเกมก่อน`
                      : p._count.users > 0
                        ? `มีบัญชี login ผูกอยู่ ${p._count.users} บัญชี — ลบ/ย้ายบัญชีออกก่อน`
                        : null;
                  return (
                    <tr key={p.id} className="align-middle hover:bg-paper-2/30">
                      <td className="px-4 py-3 font-semibold text-fg-light">{p.name}</td>
                      <td className="px-4 py-3 text-fg-light-soft">{p.contact ?? "—"}</td>
                      <td className="px-4 py-3 text-[12px] text-fg-light-mute">
                        {p.note ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-full bg-paper-2 px-2 text-[12px] font-semibold text-fg-light">
                          {p._count.shares}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.users.length === 0 ? (
                          <span className="text-[12px] text-fg-light-mute">—</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {p.users.map((u) => (
                              <span
                                key={u.id}
                                className="font-mono text-[12px] text-fg-light-soft"
                              >
                                {u.email}
                                {!u.isActive && (
                                  <span className="ml-1 text-fg-light-mute">(disabled)</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <EditPartnerButton
                            id={p.id}
                            name={p.name}
                            contact={p.contact}
                            note={p.note}
                          />
                          <DeleteButton
                            title={`Delete ${p.name}?`}
                            description={
                              deleteBlock
                                ? `ลบไม่ได้ — ${deleteBlock}`
                                : "ลบ Partner ออกจากระบบ (ไม่กระทบรายงานเก่า)"
                            }
                            successMessage="Removed"
                            action={deletePartnerOrThrow.bind(null, p.id)}
                          />
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
