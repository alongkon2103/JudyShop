import { PageHeader } from "@/components/admin/PageHeader";
import { PanelSkeleton } from "@/components/admin/Skeleton";

export default function AdminSettingsLoading() {
  return (
    <section className="space-y-4">
      <PageHeader kicker="System" title="Settings" subtitle="กำลังโหลดการตั้งค่า…" />
      <PanelSkeleton rows={3} />
    </section>
  );
}
