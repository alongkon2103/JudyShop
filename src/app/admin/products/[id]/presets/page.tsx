import { notFound } from "next/navigation";
import Link from "next/link";
import { FileBox, Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ReorderButtons } from "@/components/admin/ReorderButtons";
import { PresetForm } from "./PresetForm";
import { deletePreset, movePreset } from "../_actions";

function formatBytes(n: number | null | undefined) {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export default async function PresetsTab({ params }: { params: { id: string } }) {
  await requireAdmin();
  const product = await db.product.findUnique({
    where: { id: params.id },
    include: { presets: { orderBy: { displayOrder: "asc" } } },
  });
  if (!product) notFound();

  return (
    <div className="space-y-4">
      <div className="panel rounded-xl p-4 sm:p-5">
        <h2 className="mb-3 text-[15px] font-semibold text-fg-light">Add preset file</h2>
        <PresetForm productId={product.id} />
      </div>

      {product.presets.length === 0 ? (
        <EmptyState
          icon={<FileBox size={20} />}
          title="No preset files yet"
          description="อัพโหลด preset ให้ลูกค้าดาวน์โหลดได้"
        />
      ) : (
        <div className="panel overflow-hidden rounded-xl">
          <div className="border-b border-line-light px-4 py-2 text-[12px] font-semibold text-fg-light-soft">
            {product.presets.length} preset{product.presets.length === 1 ? "" : "s"}
          </div>
          <ul className="divide-y divide-line-light">
            {product.presets.map((p, i) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-6 text-center text-[12px] font-semibold text-fg-light-mute">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-2 text-[14px] font-semibold text-fg-light">
                    {p.nameEn}
                    {!p.isActive && <StatusBadge tone="muted">Disabled</StatusBadge>}
                    {p.targetProgram && <StatusBadge tone="info">{p.targetProgram}</StatusBadge>}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-fg-light-mute">
                    {p.fileName} · {formatBytes(p.fileSize)}
                  </p>
                </div>
                <Link
                  href={p.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-light px-3 text-[11px] font-semibold text-fg-light-soft hover:bg-paper-2 hover:text-fg-light"
                >
                  <Download size={12} strokeWidth={2.5} /> Open
                </Link>
                <ReorderButtons
                  canUp={i > 0}
                  canDown={i < product.presets.length - 1}
                  move={movePreset.bind(null, product.id, p.id)}
                />
                <DeleteButton
                  title={`Delete preset "${p.nameEn}"?`}
                  description="ไฟล์ preset จะถูกลบจาก Storage และฐานข้อมูล"
                  successMessage="Preset deleted"
                  action={deletePreset.bind(null, product.id, p.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
