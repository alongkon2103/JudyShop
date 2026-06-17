import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { NewsForm } from "./NewsForm";
import { TogglePublished } from "./TogglePublished";
import { deleteNews } from "./_actions";

export const metadata: Metadata = { title: "News" };

const CATEGORY_TONE = {
  UPDATE: "info",
  ANNOUNCE: "accent",
  EVENT: "ok",
  MAINTENANCE: "warn",
} as const;

function fmtDate(d: Date) {
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function NewsPage() {
  await requireAdmin();
  const rows = await db.news.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="Operations"
        title="News"
        subtitle={`บทความข่าวที่แสดงในหน้า /news — ${rows.length} item${rows.length === 1 ? "" : "s"}`}
      />

      <div className="panel rounded-xl p-4 sm:p-5">
        <h2 className="mb-3 text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
          Add news
        </h2>
        <NewsForm />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Newspaper size={20} />}
          title="No news yet"
          description="สร้างข่าวแรกเพื่อแสดงในหน้า /news"
        />
      ) : (
        <div className="panel overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
              <thead className="border-b border-line-light bg-paper-2/40 text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
                <tr>
                  <th className="px-4 py-2.5 font-semibold" style={{ width: "104px" }}>Image</th>
                  <th className="px-4 py-2.5 font-semibold">Title</th>
                  <th className="px-4 py-2.5 font-semibold">Category</th>
                  <th className="px-4 py-2.5 font-semibold">Published</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light text-fg-light">
                {rows.map((n) => (
                  <tr key={n.id} className="align-middle hover:bg-paper-2/30">
                    <td className="px-4 py-3">
                      <div className="h-14 w-20 overflow-hidden rounded-md border border-line-light bg-paper-2">
                        {n.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={n.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-[10px] text-fg-light-mute">
                            no image
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="truncate text-[14px] font-semibold text-fg-light">{n.titleEn}</p>
                        <span className="text-[12px] text-fg-light-soft">· {n.titleTh}</span>
                      </div>
                      <p className="line-clamp-1 max-w-md text-[12px] text-fg-light-soft">
                        {n.excerptEn ?? n.excerptTh ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={CATEGORY_TONE[n.category]}>{n.category}</StatusBadge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[11px] text-fg-light-soft">
                      {fmtDate(n.publishedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={n.isPublished ? "ok" : "muted"}>
                        {n.isPublished ? "Published" : "Hidden"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <TogglePublished id={n.id} isPublished={n.isPublished} />
                        <Link
                          href={`/admin/news/${n.id}`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-light px-4 text-[11px] font-semibold text-fg-light-soft transition-colors hover:bg-paper-2 hover:text-fg-light"
                        >
                          <Pencil size={12} strokeWidth={2.5} /> Edit
                        </Link>
                        <DeleteButton
                          title={`Delete "${n.titleEn}"?`}
                          description="ลบบทความข่าวออกจากระบบและจาก /news"
                          successMessage="News deleted"
                          action={deleteNews.bind(null, n.id)}
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
