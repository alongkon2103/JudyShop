import { PageHeader } from "@/components/admin/PageHeader";
import { TableSkeleton } from "@/components/admin/Skeleton";

export default function AdminProductsLoading() {
  return (
    <section>
      <PageHeader kicker="Catalogue" title="Products" subtitle="กำลังโหลดรายการสินค้า…" />
      <TableSkeleton rows={5} columns={5} />
    </section>
  );
}
