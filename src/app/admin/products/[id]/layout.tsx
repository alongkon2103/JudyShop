import { notFound } from "next/navigation";
import { Settings, Coins, Image as ImageIcon, Gift, FileBox } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { TabNav } from "@/components/admin/TabNav";

export default async function EditProductLayout({
  params,
  children,
}: {
  params: { id: string };
  children: React.ReactNode;
}) {
  await requireAdmin();

  const product = await db.product.findUnique({
    where: { id: params.id },
    include: {
      _count: {
        select: { plans: true, images: true, giftOverlays: true, presets: true },
      },
    },
  });
  if (!product) notFound();

  const base = `/admin/products/${product.id}`;
  const tabs = [
    { href: `${base}/details`,  label: "Details",  icon: <Settings size={14} strokeWidth={2.25} /> },
    { href: `${base}/plans`,    label: "Plans",    icon: <Coins size={14} strokeWidth={2.25} />,     count: product._count.plans },
    { href: `${base}/images`,   label: "Images",   icon: <ImageIcon size={14} strokeWidth={2.25} />, count: product._count.images },
    { href: `${base}/overlays`, label: "Gift overlays", icon: <Gift size={14} strokeWidth={2.25} />, count: product._count.giftOverlays },
    { href: `${base}/presets`,  label: "Presets",  icon: <FileBox size={14} strokeWidth={2.25} />,   count: product._count.presets },
  ];

  return (
    <section className="mx-auto max-w-4xl space-y-s4">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Products", href: "/admin/products" },
          { label: product.nameEn },
        ]}
        kicker={`/${product.slug}`}
        title={product.nameEn}
        subtitle={`${product.nameTh} · ${product._count.plans} plans · ${product._count.images} images`}
        actions={
          <div className="flex flex-wrap items-center gap-s2">
            <StatusBadge tone={product.isActive ? "ok" : "muted"}>
              {product.isActive ? "Active" : "Hidden"}
            </StatusBadge>
            {product.comingSoon && <StatusBadge tone="warn">Coming soon</StatusBadge>}
            {product.badge && <StatusBadge tone="accent">{product.badge}</StatusBadge>}
          </div>
        }
      />

      <TabNav tabs={tabs} />

      {children}
    </section>
  );
}
