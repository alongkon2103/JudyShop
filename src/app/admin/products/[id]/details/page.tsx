import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { EditDetailsForm } from "./EditDetailsForm";

export default async function ProductDetailsTab({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const product = await db.product.findUnique({ where: { id: params.id } });
  if (!product) notFound();

  return (
    <div className="panel rounded-xl p-s4 sm:p-s5">
      <EditDetailsForm
        product={{
          id: product.id,
          slug: product.slug,
          nameEn: product.nameEn,
          nameTh: product.nameTh,
          shortNameEn: product.shortNameEn,
          shortNameTh: product.shortNameTh,
          descriptionEn: product.descriptionEn,
          descriptionTh: product.descriptionTh,
          shortDescriptionEn: product.shortDescriptionEn,
          shortDescriptionTh: product.shortDescriptionTh,
          badge: product.badge,
          gameId: product.gameId,
          gamePresetUrl: product.gamePresetUrl,
          isActive: product.isActive,
          comingSoon: product.comingSoon,
          trialEnabled: product.trialEnabled,
          trialMinutes: product.trialMinutes,
          displayOrder: product.displayOrder,
        }}
      />
    </div>
  );
}
