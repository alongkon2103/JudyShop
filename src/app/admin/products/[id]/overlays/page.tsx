import { notFound } from "next/navigation";
import Image from "next/image";
import { Gift } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ReorderButtons } from "@/components/admin/ReorderButtons";
import { OverlayForm } from "./OverlayForm";
import { deleteOverlay, moveOverlay } from "../_actions";

export default async function OverlaysTab({ params }: { params: { id: string } }) {
  await requireAdmin();
  const product = await db.product.findUnique({
    where: { id: params.id },
    include: { giftOverlays: { orderBy: { displayOrder: "asc" } } },
  });
  if (!product) notFound();

  return (
    <div className="space-y-4">
      <div className="panel rounded-xl p-4 sm:p-5">
        <h2 className="mb-3 text-[15px] font-semibold text-fg-light">Add gift overlay</h2>
        <OverlayForm productId={product.id} />
      </div>

      {product.giftOverlays.length === 0 ? (
        <EmptyState
          icon={<Gift size={20} />}
          title="No gift overlays yet"
          description="ภาพ overlay  — ใช้ลูกศรจัดลำดับการแสดง"
        />
      ) : (
        <div className="panel overflow-hidden rounded-xl">
          <div className="border-b border-line-light px-4 py-2 text-[12px] font-semibold text-fg-light-soft">
            {product.giftOverlays.length} overlay{product.giftOverlays.length === 1 ? "" : "s"}
          </div>
          <ul className="divide-y divide-line-light">
            {product.giftOverlays.map((g, i) => (
              <li key={g.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 text-center text-[12px] font-semibold text-fg-light-mute">
                  {i + 1}
                </span>
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-paper-2">
                  <Image
                    src={g.imageUrl}
                    alt={g.giftNameEn}
                    fill
                    sizes="56px"
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-fg-light">
                    {g.giftNameEn}
                    {!g.isActive && <StatusBadge tone="muted">Disabled</StatusBadge>}
                  </p>
                  <p className="truncate text-[11px] text-fg-light-mute">{g.giftNameTh}</p>
                </div>
                <ReorderButtons
                  canUp={i > 0}
                  canDown={i < product.giftOverlays.length - 1}
                  move={moveOverlay.bind(null, product.id, g.id)}
                />
                <DeleteButton
                  title={`Delete overlay "${g.giftNameEn}"?`}
                  description="ภาพ overlay จะถูกลบจาก Storage และฐานข้อมูล"
                  successMessage="Overlay deleted"
                  action={deleteOverlay.bind(null, product.id, g.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
