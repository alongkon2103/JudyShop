import { PageHeader } from "@/components/admin/PageHeader";
import { TableSkeleton, PanelSkeleton } from "@/components/admin/Skeleton";

export default function AdminNewsLoading() {
  return (
    <section className="space-y-6">
      <PageHeader kicker="Operations" title="News" subtitle="กำลังโหลดข่าวสาร…" />
      <PanelSkeleton rows={4} />
      <TableSkeleton rows={4} columns={6} />
    </section>
  );
}
