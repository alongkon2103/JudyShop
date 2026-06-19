import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { HowToUseForm } from "../HowToUseForm";

export default async function EditHowToUsePage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const video = await db.howToUseVideo.findUnique({ where: { id: params.id } });
  if (!video) notFound();

  return (
    <section className="space-y-6">
      <Link
        href="/admin/how-to-use"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-fg-light-soft hover:text-fg-light"
      >
        <ArrowLeft size={14} strokeWidth={2.25} />
        Back to list
      </Link>

      <PageHeader
        kicker="System"
        title="Edit video"
        subtitle={video.titleEn}
      />

      <div className="panel rounded-xl p-4 sm:p-5">
        <HowToUseForm
          initial={{
            id: video.id,
            titleEn: video.titleEn,
            titleTh: video.titleTh,
            descriptionEn: video.descriptionEn,
            descriptionTh: video.descriptionTh,
            youtubeUrl: video.youtubeUrl,
            displayOrder: video.displayOrder,
            isActive: video.isActive,
          }}
        />
      </div>
    </section>
  );
}
