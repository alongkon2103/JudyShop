import { PageHeader } from "@/components/admin/PageHeader";
import { TableSkeleton, Skeleton } from "@/components/admin/Skeleton";

export default function AdminTransactionsLoading() {
  return (
    <section className="space-y-6">
      <PageHeader kicker="Operations" title="Transactions" subtitle="กำลังโหลดออเดอร์…" />
      <div className="panel flex flex-wrap items-center gap-1 rounded-full p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-full" />
        ))}
      </div>
      <TableSkeleton rows={8} columns={7} />
    </section>
  );
}
