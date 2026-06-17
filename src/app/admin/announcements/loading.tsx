import { PageHeader } from "@/components/admin/PageHeader";
import { TableSkeleton, PanelSkeleton } from "@/components/admin/Skeleton";

export default function AdminAnnouncementsLoading() {
  return (
    <section className="space-y-6">
      <PageHeader kicker="Operations" title="Announcements" subtitle="กำลังโหลดประกาศ…" />
      <PanelSkeleton rows={4} />
      <TableSkeleton rows={4} columns={5} />
    </section>
  );
}
