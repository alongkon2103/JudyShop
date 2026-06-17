import { notFound } from "next/navigation";
import Image from "next/image";
import { ImageIcon, Star } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { EmptyState } from "@/components/admin/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ReorderButtons } from "@/components/admin/ReorderButtons";
import { ImageUploadForm } from "./ImageUploadForm";
import { SetThumbnailButton } from "./SetThumbnailButton";
import { deleteImage, moveImage } from "../_actions";

export default async function ImagesTab({ params }: { params: { id: string } }) {
  await requireAdmin();
  const product = await db.product.findUnique({
    where: { id: params.id },
    include: { images: { orderBy: { displayOrder: "asc" } } },
  });
  if (!product) notFound();

  return (
    <div className="space-y-4">
      <div className="panel rounded-xl p-4 sm:p-5">
        <h2 className="mb-3 text-[15px] font-semibold text-fg-light">Add image</h2>
        <ImageUploadForm productId={product.id} />
      </div>

      {product.images.length === 0 ? (
        <EmptyState
          icon={<ImageIcon size={20} />}
          title="No images yet"
          description="อัพโหลดรูปสินค้า — ตัวแรกในรายการจะเป็นรูปที่แสดงในร้าน. ใช้ลูกศรเลื่อนเพื่อจัดลำดับ."
        />
      ) : (
        <div className="panel overflow-hidden rounded-xl">
          <div className="border-b border-line-light px-4 py-2 text-[12px] font-semibold text-fg-light-soft">
            {product.images.length} image{product.images.length === 1 ? "" : "s"} · ลำดับบนสุดแสดงเป็นภาพหลัก
          </div>
          <ul className="divide-y divide-line-light">
            {product.images.map((img, i) => (
              <li key={img.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 text-center text-[12px] font-semibold text-fg-light-mute">
                  {i + 1}
                </span>
                <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-paper-2">
                  <Image
                    src={img.url}
                    alt={img.altEn ?? "product image"}
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-fg-light">
                    Image #{i + 1}
                    {img.isThumbnail && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/15 px-2 py-0.5 text-[10px] font-semibold text-pink-500">
                        <Star size={9} strokeWidth={2.5} /> Thumbnail
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-fg-light-mute">{img.url}</p>
                </div>
                <ReorderButtons
                  canUp={i > 0}
                  canDown={i < product.images.length - 1}
                  move={moveImage.bind(null, product.id, img.id)}
                />
                {!img.isThumbnail && (
                  <SetThumbnailButton productId={product.id} imageId={img.id} />
                )}
                <DeleteButton
                  title="Delete this image?"
                  description="ภาพจะถูกลบจาก Storage และฐานข้อมูล"
                  successMessage="Image deleted"
                  action={deleteImage.bind(null, product.id, img.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
