import type { Metadata } from "next";
import Link from "next/link";
import { PlayCircle, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { HowToUseForm } from "./HowToUseForm";
import { deleteHowToUseVideo } from "./_actions";

export const metadata: Metadata = { title: "How to use" };

async function deleteOrThrow(id: string) {
  "use server";
  const res = await deleteHowToUseVideo(id);
  if (!res.ok) throw new Error(res.error);
}

export default async function HowToUsePage() {
  await requireAdmin();

  const videos = await db.howToUseVideo.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="System"
        title="How to use"
        subtitle={`วิดีโอสอนการใช้งาน — total ${videos.length}`}
      />

      <div className="panel rounded-xl p-4 sm:p-5">
        <h2 className="mb-3 text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
          Add video
        </h2>
        <HowToUseForm />
      </div>

      {videos.length === 0 ? (
        <EmptyState
          icon={<PlayCircle size={20} />}
          title="ยังไม่มีวิดีโอ"
          description="เพิ่ม YouTube URL ผ่านฟอร์มด้านบน"
        />
      ) : (
        <div className="panel overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <thead className="border-b border-line-light bg-paper-2/40 text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Title</th>
                  <th className="px-4 py-2.5 font-semibold">YouTube ID</th>
                  <th className="px-4 py-2.5 font-semibold">Order</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light text-fg-light">
                {videos.map((v) => (
                  <tr key={v.id} className="align-middle hover:bg-paper-2/30">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-fg-light">{v.titleEn}</p>
                      <p className="text-[11px] text-fg-light-soft">{v.titleTh}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px] text-fg-light-soft">{v.videoId}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-fg-light-soft">
                      {v.displayOrder}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={v.isActive ? "ok" : "muted"}>
                        {v.isActive ? "Active" : "Hidden"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/how-to-use/${v.id}`}
                          title="Edit"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line-light text-fg-light-soft transition-colors hover:bg-paper-2 hover:text-fg-light"
                        >
                          <Pencil size={13} strokeWidth={2.25} />
                        </Link>
                        <DeleteButton
                          title={`Delete "${v.titleEn}"?`}
                          description="วิดีโอจะถูกลบจากหน้าสาธารณะทันที"
                          successMessage="Removed"
                          action={deleteOrThrow.bind(null, v.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
