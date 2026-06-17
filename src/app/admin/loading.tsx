import { PageHeader } from "@/components/admin/PageHeader";
import { StatTileSkeleton, Skeleton } from "@/components/admin/Skeleton";

/** Dashboard placeholder while server queries run. */
export default function AdminDashboardLoading() {
  return (
    <section className="flex flex-col gap-s4">
      <PageHeader kicker="Overview" title="Dashboard" subtitle="กำลังโหลดภาพรวมระบบ…" />

      <ul className="grid grid-cols-2 gap-s3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatTileSkeleton key={i} />
        ))}
      </ul>

      <section className="panel rounded-md p-s3 sm:p-s4">
        <Skeleton className="mb-s3 h-4 w-32" />
        <Skeleton className="h-[240px] w-full" />
      </section>

      <div className="grid grid-cols-1 gap-s4 lg:grid-cols-3">
        <section className="panel rounded-md p-s3 sm:p-s4 lg:col-span-2">
          <Skeleton className="mb-s3 h-4 w-28" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
        </section>
        <section className="panel rounded-md p-s3 sm:p-s4">
          <Skeleton className="mb-s3 h-4 w-32" />
          <Skeleton className="mx-auto h-[160px] w-[160px] rounded-full" />
        </section>
      </div>
    </section>
  );
}
