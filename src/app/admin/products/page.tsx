import type { Metadata } from "next";
import Image from "next/image";
import { Plus, Package, ImageOff } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { AdminButton } from "@/components/admin/Button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteProductById } from "./_actions";
import { ReorderButtons } from "./ReorderButtons";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProductsPage() {
  await requireAdmin();

  const products = await db.product.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    include: {
      images: {
        orderBy: [{ isThumbnail: "desc" }, { displayOrder: "asc" }],
        take: 1,
      },
      _count: { select: { plans: true, images: true, whitelist: true, giftOverlays: true, presets: true } },
    },
  });

  return (
    <section>
      <PageHeader
        kicker="Catalogue"
        title="Products"
        subtitle="เกม / Whitelist ทั้งหมดในร้าน — ใช้ลูกศร ▲▼ จัดลำดับการแสดงผล, คลิก Edit เพื่อจัดการรายละเอียด, Plan, รูปภาพ และไฟล์ Preset"
        actions={
          <AdminButton href="/admin/products/new">
            <Plus size={14} strokeWidth={2.5} /> New product
          </AdminButton>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          icon={<Package size={20} />}
          title="No products yet"
          description="Add your first product to populate the public shop and start selling whitelist access."
          action={
            <AdminButton href="/admin/products/new">
              <Plus size={14} strokeWidth={2.5} /> Create product
            </AdminButton>
          }
        />
      ) : (
        <div className="panel overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-left text-[13px]">
              <thead className="border-b border-line-light bg-paper-2/40 text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
                <tr>
                  <th className="px-3 py-2.5 text-center font-semibold" style={{ width: "56px" }}>Order</th>
                  <th className="px-4 py-2.5 font-semibold" style={{ width: "112px" }}>Image</th>
                  <th className="px-4 py-2.5 font-semibold">Product</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Items</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light text-fg-light">
                {products.map((p, i) => (
                  <tr key={p.id} className="align-middle hover:bg-paper-2/30">
                    <td className="px-3 py-3">
                      <ReorderButtons
                        id={p.id}
                        isFirst={i === 0}
                        isLast={i === products.length - 1}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative h-14 w-20 overflow-hidden rounded-md border border-line-light bg-paper-2">
                        {p.images[0] ? (
                          <Image
                            src={p.images[0].url}
                            alt={p.images[0].altEn ?? p.nameEn}
                            fill
                            sizes="80px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-fg-light-mute">
                            <ImageOff size={16} strokeWidth={2} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <h3 className="truncate text-[14px] font-semibold text-fg-light">{p.nameEn}</h3>
                        <span className="text-[12px] font-medium text-fg-light-mute">· {p.nameTh}</span>
                      </div>
                      <p className="text-[11px] font-medium text-fg-light-mute">/{p.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge tone={p.isActive ? "ok" : "muted"}>
                          {p.isActive ? "Active" : "Hidden"}
                        </StatusBadge>
                        {p.comingSoon && <StatusBadge tone="warn">Soon</StatusBadge>}
                        {p.externalUrl && <StatusBadge tone="accent">Partner</StatusBadge>}
                        {p.badge && <StatusBadge tone="accent">{p.badge}</StatusBadge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Counter label="Plans" value={p._count.plans} />
                        <Counter label="Imgs"  value={p._count.images} />
                        <Counter label="Gifts" value={p._count.giftOverlays} />
                        <Counter label="Files" value={p._count.presets} />
                        <Counter label="WL"    value={p._count.whitelist} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <AdminButton href={`/admin/products/${p.id}`} variant="outline" size="sm">
                          Edit
                        </AdminButton>
                        <DeleteButton
                          title={`Delete "${p.nameEn}"?`}
                          description="ลบสินค้าและข้อมูลที่เชื่อมต่อทั้งหมด (plans, images, gift overlays, presets, whitelist) ออกอย่างถาวร"
                          successMessage={`Deleted "${p.nameEn}"`}
                          action={deleteProductById.bind(null, p.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-md border border-line-light px-2 py-1 text-[11px] font-medium text-fg-light-soft">
      <span>{label}</span>
      <span className="font-semibold text-fg-light">{value}</span>
    </span>
  );
}
