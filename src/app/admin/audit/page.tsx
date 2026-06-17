import type { Metadata } from "next";
import Link from "next/link";
import { History, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

function pageFromQuery(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function fmtDate(d: Date) {
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function fmtPayload(payload: unknown): string {
  if (payload == null) return "";
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

type SearchParams = {
  page?: string;
  q?: string;       // free-text against actorEmail / action
  action?: string;  // filter by exact action key
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();

  const page = pageFromQuery(searchParams.page);
  const q = (searchParams.q ?? "").trim();
  const actionFilter = (searchParams.action ?? "").trim();

  const where = {
    ...(q && {
      OR: [
        { actorEmail: { contains: q, mode: "insensitive" as const } },
        { action:     { contains: q, mode: "insensitive" as const } },
        { targetId:   { contains: q, mode: "insensitive" as const } },
      ],
    }),
    ...(actionFilter && { action: actionFilter }),
  };

  const [rows, total, distinctActions] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
    // Cheap way to populate the action filter dropdown — group by action.
    db.auditLog.groupBy({
      by: ["action"],
      orderBy: { action: "asc" },
    }),
  ]);

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="System"
        title="Audit log"
        subtitle={`บันทึกการกระทำของแอดมินทั้งหมด — total ${total}`}
      />

      <form
        action="/admin/audit"
        method="get"
        className="panel flex flex-wrap items-center gap-2 rounded-xl p-3"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            strokeWidth={2.25}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-light-mute"
          />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by email / action / target id…"
            className="w-full rounded-md border border-line-light bg-paper-2 py-2.5 pl-9 pr-3 text-[13px] text-fg-light focus:border-pink-400 focus:outline-none focus:ring-4 focus:ring-pink-400/15"
          />
        </div>
        <select
          name="action"
          defaultValue={actionFilter}
          className="rounded-md border border-line-light bg-paper-2 px-3 py-2.5 text-[13px] text-fg-light"
        >
          <option value="">All actions</option>
          {distinctActions.map((a) => (
            <option key={a.action} value={a.action}>
              {a.action}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-pink-500 px-4 py-2.5 text-[12px] font-bold text-white"
        >
          Filter
        </button>
        {(q || actionFilter) && (
          <Link
            href="/admin/audit"
            className="rounded-md border border-line-light px-3 py-2.5 text-[11px] font-semibold text-fg-light-soft hover:bg-paper-2"
          >
            Reset
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<History size={20} />}
          title="No audit entries"
          description={q || actionFilter ? "ลองล้าง filter เพื่อดูทั้งหมด" : "ระบบยังไม่มีการกระทำที่ถูกบันทึก"}
        />
      ) : (
        <div className="panel overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
              <thead className="border-b border-line-light bg-paper-2/40 text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">When</th>
                  <th className="px-4 py-2.5 font-semibold">Admin</th>
                  <th className="px-4 py-2.5 font-semibold">Action</th>
                  <th className="px-4 py-2.5 font-semibold">Target</th>
                  <th className="px-4 py-2.5 font-semibold">Payload</th>
                  <th className="px-4 py-2.5 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light text-fg-light">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-paper-2/30">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-fg-light-soft">
                      {fmtDate(row.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] text-fg-light">
                      {row.actorEmail ?? <span className="text-fg-light-mute">system</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] font-semibold text-pink-500">
                      {row.action}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-fg-light-soft">
                      {row.targetType ? (
                        <span className="font-mono text-[11px]">
                          {row.targetType}
                          {row.targetId ? `:${row.targetId}` : ""}
                        </span>
                      ) : (
                        <span className="text-fg-light-mute">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-fg-light-soft">
                      <code className="break-all">{fmtPayload(row.payload)}</code>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-fg-light-mute">
                      {row.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            basePath="/admin/audit"
            query={{ q, action: actionFilter }}
          />
        </div>
      )}
    </section>
  );
}
