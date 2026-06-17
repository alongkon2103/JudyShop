import { PageHeader } from "@/components/admin/PageHeader";
import { PanelSkeleton, Skeleton } from "@/components/admin/Skeleton";

export default function AdminProductDetailLoading() {
  return (
    <section className="space-y-4">
      <PageHeader
        kicker="Catalogue"
        title="Product"
        subtitle="กำลังโหลดรายละเอียดสินค้า…"
        breadcrumbs={[{ label: "Products", href: "/admin/products" }, { label: "Edit" }]}
      />
      {/* Tab nav skeleton */}
      <div className="panel -mx-1 flex gap-2 overflow-x-auto rounded-full p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <PanelSkeleton rows={6} />
    </section>
  );
}
