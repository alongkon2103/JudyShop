import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { NewsForm } from "../NewsForm";

export const metadata: Metadata = { title: "Edit news" };

export default async function EditNewsPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const row = await db.news.findUnique({ where: { id: params.id } });
  if (!row) notFound();

  return (
    <section className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "News", href: "/admin/news" },
          { label: "Edit" },
        ]}
        kicker="Operations"
        title="Edit news"
      />

      <div className="panel rounded-xl p-4 sm:p-5">
        <NewsForm
          existing={{
            id:          row.id,
            titleEn:     row.titleEn,
            titleTh:     row.titleTh,
            excerptEn:   row.excerptEn,
            excerptTh:   row.excerptTh,
            imageUrl:    row.imageUrl,
            category:    row.category,
            publishedAt: row.publishedAt,
            isPublished: row.isPublished,
          }}
        />
      </div>
    </section>
  );
}
