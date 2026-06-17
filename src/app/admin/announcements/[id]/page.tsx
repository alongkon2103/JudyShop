import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { AnnouncementForm } from "../AnnouncementForm";

export const metadata: Metadata = { title: "Edit announcement" };

export default async function EditAnnouncementPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const row = await db.announcement.findUnique({ where: { id: params.id } });
  if (!row) notFound();

  return (
    <section className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Announcements", href: "/admin/announcements" },
          { label: "Edit" },
        ]}
        kicker="Operations"
        title="Edit announcement"
        subtitle="แก้ไขข้อความ / รูป / ช่วงเวลา / ความสำคัญ — บันทึกแล้วกลับไปหน้าlist"
      />

      <div className="panel rounded-xl p-4 sm:p-5">
        <AnnouncementForm
          existing={{
            id:        row.id,
            messageEn: row.messageEn,
            messageTh: row.messageTh,
            imageUrl:  row.imageUrl,
            startDate: row.startDate,
            endDate:   row.endDate,
            isActive:  row.isActive,
            priority:  row.priority,
          }}
        />
      </div>
    </section>
  );
}
