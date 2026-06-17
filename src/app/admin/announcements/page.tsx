import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { AnnouncementForm } from "./AnnouncementForm";
import { ToggleActive } from "./ToggleActive";
import { deleteAnnouncement } from "./_actions";

export const metadata: Metadata = { title: "Announcements" };

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function AnnouncementsPage() {
  await requireAdmin();
  const rows = await db.announcement.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  const now = new Date();
  const liveCount = rows.filter(
    (a) =>
      a.isActive &&
      a.startDate <= now &&
      (a.endDate === null || a.endDate > now),
  ).length;

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="Operations"
        title="Announcements"
        subtitle={`ประกาศที่จะแสดงเป็น popup หน้าร้าน — ${liveCount} live now · ${rows.length} total`}
      />

      <div className="panel rounded-xl p-4 sm:p-5">
        <h2 className="mb-3 text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
          Add announcement
        </h2>
        <AnnouncementForm />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={20} />}
          title="No announcements"
          description="สร้างประกาศแรกเพื่อแสดง popup ให้ผู้เข้าชมเห็นทันทีที่เปิดเว็บ"
        />
      ) : (
        <div className="panel overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
              <thead className="border-b border-line-light bg-paper-2/40 text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
                <tr>
                  <th className="px-4 py-2.5 font-semibold" style={{ width: "104px" }}>Image</th>
                  <th className="px-4 py-2.5 font-semibold">Message</th>
                  <th className="px-4 py-2.5 font-semibold">Window</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light text-fg-light">
                {rows.map((a) => {
                  const live =
                    a.isActive &&
                    a.startDate <= now &&
                    (a.endDate === null || a.endDate > now);
                  return (
                    <tr key={a.id} className="align-middle hover:bg-paper-2/30">
                      <td className="px-4 py-3">
                        {a.imageUrl ? (
                          <div className="h-14 w-20 overflow-hidden rounded-md border border-line-light bg-paper-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.imageUrl} alt="" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="grid h-14 w-20 place-items-center rounded-md border border-line-light bg-paper-2 text-[10px] text-fg-light-mute">
                            no image
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {a.messageEn ? (
                          <p className="text-[14px] font-semibold text-fg-light">{a.messageEn}</p>
                        ) : a.imageUrl ? (
                          <p className="text-[13px] italic text-fg-light-soft">— image only —</p>
                        ) : (
                          <p className="text-[13px] italic text-fg-light-mute">—</p>
                        )}
                        {a.messageTh && (
                          <p className="text-[12px] text-fg-light-soft">{a.messageTh}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[11px] text-fg-light-soft">
                        <p>{fmtDate(a.startDate)}</p>
                        <p className="text-fg-light-mute">→ {fmtDate(a.endDate)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={live ? "ok" : a.isActive ? "warn" : "muted"}>
                          {live ? "Live" : a.isActive ? "Scheduled" : "Off"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <ToggleActive id={a.id} isActive={a.isActive} />
                          <Link
                            href={`/admin/announcements/${a.id}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-light px-4 text-[11px] font-semibold text-fg-light-soft transition-colors hover:bg-paper-2 hover:text-fg-light"
                          >
                            <Pencil size={12} strokeWidth={2.5} /> Edit
                          </Link>
                          <DeleteButton
                            title="Delete this announcement?"
                            description="ประกาศจะถูกลบจากระบบและจะไม่ปรากฏให้ผู้ใช้เห็นทันที"
                            successMessage="Announcement deleted"
                            action={deleteAnnouncement.bind(null, a.id)}
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
