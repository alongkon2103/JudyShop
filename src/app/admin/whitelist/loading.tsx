import { PageHeader } from "@/components/admin/PageHeader";
import { TableSkeleton, Skeleton } from "@/components/admin/Skeleton";

export default function AdminWhitelistLoading() {
  return (
    <section className="space-y-6">
      <PageHeader kicker="Operations" title="Whitelist" subtitle="กำลังโหลดรายชื่อ…" />
      <div className="panel rounded-xl p-4 sm:p-5">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="h-10 w-full" />
      </div>
      <TableSkeleton rows={6} columns={7} />
    </section>
  );
}
