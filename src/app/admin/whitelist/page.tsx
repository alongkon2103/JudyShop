import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { Pagination } from "@/components/admin/Pagination";
import { NewWhitelistForm } from "./NewWhitelistForm";
import { WhitelistFilters } from "./WhitelistFilters";
import { EditWhitelistButton } from "./EditWhitelistButton";
import { deleteWhitelist } from "./_actions";

export const metadata: Metadata = { title: "Whitelist" };

const PAGE_SIZE = 50;

function pageFromQuery(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  // Use the full month name so "June" / "July" / "January" are immediately
  // distinguishable — the 3-letter abbreviation made it easy to mis-read
  // "Jun" as "Jul" in the table.
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

/**
 * Human-friendly "time until" / "time ago" label that scales the unit
 * down to seconds/minutes/hours when the gap is < a day. The old
 * implementation used `Math.ceil(ms / day)` which rounded a 5-minute
 * trial up to "1d left" — clearly wrong.
 *
 * Returns null for `d == null` (no expiry stored).
 */
function timeUntil(
  d: Date | null,
  now: Date,
): { label: string; tone: "expired" | "soon" | "ok" } | null {
  if (!d) return null;
  const ms = d.getTime() - now.getTime();
  const past = ms < 0;
  const abs = Math.abs(ms);

  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  let label: string;
  if (abs < MIN) {
    const s = Math.max(1, Math.floor(abs / 1000));
    label = `${s}s`;
  } else if (abs < HOUR) {
    label = `${Math.floor(abs / MIN)}m`;
  } else if (abs < DAY) {
    label = `${Math.floor(abs / HOUR)}h`;
  } else {
    label = `${Math.floor(abs / DAY)}d`;
  }

  const tone: "expired" | "soon" | "ok" = past
    ? "expired"
    : abs <= 7 * DAY
      ? "soon"
      : "ok";
  return { label: past ? `${label} ago` : `${label} left`, tone };
}

type SearchParams = { q?: string; product?: string; page?: string };

export default async function WhitelistPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();

  const q = (searchParams.q ?? "").trim();
  const product = (searchParams.product ?? "").trim();
  const page = pageFromQuery(searchParams.page);

  const products = await db.product.findMany({
    orderBy: { nameEn: "asc" },
    select: { id: true, slug: true, nameEn: true },
  });

  // Per-product whitelist stats shown at the top of the page so the
  // admin can see "which game has how many" at a glance. Three grouped
  // queries in parallel — total / active / lifetime per product.
  const statsNow = new Date();
  const [totalByProduct, activeByProduct, lifetimeByProduct] = await Promise.all([
    db.whitelist.groupBy({ by: ["productId"], _count: { _all: true } }),
    db.whitelist.groupBy({
      by: ["productId"],
      where: { OR: [{ isLifetime: true }, { expireDate: { gt: statsNow } }] },
      _count: { _all: true },
    }),
    db.whitelist.groupBy({
      by: ["productId"],
      where: { isLifetime: true },
      _count: { _all: true },
    }),
  ]);

  const statsMap = new Map<string, { total: number; active: number; lifetime: number }>();
  for (const p of products) {
    statsMap.set(p.id, { total: 0, active: 0, lifetime: 0 });
  }
  for (const row of totalByProduct) {
    const s = statsMap.get(row.productId);
    if (s) s.total = row._count._all;
  }
  for (const row of activeByProduct) {
    const s = statsMap.get(row.productId);
    if (s) s.active = row._count._all;
  }
  for (const row of lifetimeByProduct) {
    const s = statsMap.get(row.productId);
    if (s) s.lifetime = row._count._all;
  }

  const totalsAll = {
    total: [...statsMap.values()].reduce((a, b) => a + b.total, 0),
    active: [...statsMap.values()].reduce((a, b) => a + b.active, 0),
    lifetime: [...statsMap.values()].reduce((a, b) => a + b.lifetime, 0),
  };

  // buildHref preserves the free-text `q` search while toggling the
  // product filter — clicking a card that's already selected clears it.
  const buildHref = (productId: string | null) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (productId) sp.set("product", productId);
    const qs = sp.toString();
    return `/admin/whitelist${qs ? `?${qs}` : ""}`;
  };

  // Free-text search spans every column an admin might recognise the
  // entry by: the username itself, the label (which now holds the
  // buyer's "Stripe: email" for purchased rows and admin notes for
  // manual rows), the `addedBy` field (admin email or "stripe"/
  // "payhip"), the product's English + Thai name, and even the source
  // enum so typing "STRIPE" works as expected.
  const SOURCES = ["STRIPE", "MANUAL", "PROMO", "TRIAL", "REFUND_REVERT"] as const;
  const matchedSource = SOURCES.find((s) => s === q.toUpperCase());
  const where: Parameters<typeof db.whitelist.findMany>[0] extends infer T
    ? T extends { where?: infer W } ? W : never : never = {
    ...(q && {
      OR: [
        { username: { contains: q, mode: "insensitive" as const } },
        { label:    { contains: q, mode: "insensitive" as const } },
        { addedBy:  { contains: q, mode: "insensitive" as const } },
        { product: { nameEn: { contains: q, mode: "insensitive" as const } } },
        { product: { nameTh: { contains: q, mode: "insensitive" as const } } },
        ...(matchedSource ? [{ source: matchedSource }] : []),
      ],
    }),
    ...(product && { productId: product }),
  };

  const [rows, total] = await Promise.all([
    db.whitelist.findMany({
      where,
      orderBy: { addedAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { product: { select: { slug: true, nameEn: true } } },
    }),
    db.whitelist.count({ where }),
  ]);

  const now = new Date();

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="Operations"
        title="Whitelist"
        subtitle={`รายชื่อผู้ใช้ที่มีสิทธิ์เข้าเกม — total ${total}`}
      />

      {/* Per-product stats — click any card to filter the table below.
          Clicking the already-selected card toggles the filter off.
          Kept deliberately quiet visually: only the border colour
          changes on hover/select, no background flood. */}
      <div className="panel rounded-xl p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
            Whitelist by game
          </h2>
          <div className="flex items-center gap-3 text-[11px] text-fg-light-mute">
            <span>
              Active <span className="font-semibold text-fg-light">{totalsAll.active.toLocaleString()}</span>
            </span>
            <span className="text-line-light">·</span>
            <span>
              Lifetime <span className="font-semibold text-fg-light">{totalsAll.lifetime.toLocaleString()}</span>
            </span>
            <span className="text-line-light">·</span>
            <span>
              Total <span className="font-semibold text-fg-light">{totalsAll.total.toLocaleString()}</span>
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => {
            const s = statsMap.get(p.id) ?? { total: 0, active: 0, lifetime: 0 };
            const isFiltered = product === p.id;
            const href = buildHref(isFiltered ? null : p.id);
            return (
              <Link
                key={p.id}
                href={href}
                aria-pressed={isFiltered}
                title={isFiltered ? `Click again to clear filter` : `Filter to ${p.nameEn}`}
                className={
                  "block rounded-lg border px-4 py-3 transition-colors " +
                  (isFiltered
                    ? "border-pink-500/80"
                    : "border-line-light hover:border-fg-light-mute/40")
                }
              >
                <p className="truncate text-[13px] font-medium text-fg-light" title={p.nameEn}>
                  {p.nameEn}
                </p>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-[22px] font-semibold leading-none tabular-nums text-fg-light">
                    {s.active.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-fg-light-mute">
                    / {s.total.toLocaleString()} total
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-fg-light-mute">
                  Lifetime{" "}
                  <span className="font-medium text-fg-light-soft tabular-nums">
                    {s.lifetime.toLocaleString()}
                  </span>
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="panel rounded-xl p-4 sm:p-5">
        <h2 className="mb-3 text-[14px] font-semibold uppercase tracking-[0.06em] text-fg-light">
          Add manual entry
        </h2>
        <NewWhitelistForm products={products} />
      </div>

      {/* Filters — client-side, debounced, updates URL via router.replace */}
      <WhitelistFilters initialQ={q} initialProduct={product} products={products} />

      {rows.length === 0 ? (
        <EmptyState
          icon={<ScrollText size={20} />}
          title="No whitelist entries"
          description={q || product ? "ลองล้าง filter เพื่อดูทั้งหมด" : "ใส่ผู้ใช้คนแรกผ่านฟอร์มด้านบน"}
        />
      ) : (
        <div className="panel overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
              <thead className="border-b border-line-light bg-paper-2/40 text-[11px] uppercase tracking-[0.06em] text-fg-light-mute">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">User · Product</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Source</th>
                  <th className="px-4 py-2.5 font-semibold">Added</th>
                  <th className="px-4 py-2.5 font-semibold">Expires</th>
                  <th className="px-4 py-2.5 font-semibold">Label</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light text-fg-light">
                {rows.map((row) => {
                  const active = row.isLifetime || (row.expireDate ? row.expireDate > now : false);
                  const remaining = timeUntil(row.expireDate, now);
                  return (
                    <tr key={row.id} className="align-middle hover:bg-paper-2/30">
                      <td className="px-4 py-3">
                        <p className="font-mono text-[13px] font-semibold text-fg-light">{row.username}</p>
                        <p className="text-[11px] text-fg-light-soft">{row.product.nameEn}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={active ? "ok" : "muted"}>
                          {row.isLifetime ? "Lifetime" : active ? "Active" : "Expired"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={row.source === "STRIPE" ? "info" : "accent"}>
                          {row.source}
                        </StatusBadge>
                        {row.addedBy && (
                          <p className="mt-1 truncate text-[11px] text-fg-light-mute">{row.addedBy}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12px] text-fg-light-soft">
                        {fmtDate(row.addedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12px]">
                        {row.isLifetime ? (
                          <span className="font-semibold text-pink-500">Lifetime ∞</span>
                        ) : row.expireDate ? (
                          <span className={active ? "text-fg-light" : "text-fg-light-mute line-through"}>
                            {fmtDate(row.expireDate)}
                            {remaining && (
                              <span
                                className={
                                  "ml-1.5 text-[11px] " +
                                  (remaining.tone === "expired"
                                    ? "text-[hsl(0_70%_50%)]"
                                    : remaining.tone === "soon"
                                      ? "text-[hsl(28_85%_42%)]"
                                      : "text-fg-light-mute")
                                }
                              >
                                ({remaining.label})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-fg-light-mute">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-fg-light-soft">
                        {row.label ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <EditWhitelistButton
                            id={row.id}
                            username={row.username}
                            productName={row.product.nameEn}
                            source={row.source}
                            isLifetime={row.isLifetime}
                            expireDate={row.expireDate?.toISOString() ?? null}
                            label={row.label}
                          />
                          <DeleteButton
                            title={`Remove ${row.username}?`}
                            description={`เอา ${row.username} ออกจาก whitelist ของ ${row.product.nameEn}`}
                            successMessage="Removed"
                            action={deleteWhitelist.bind(null, row.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            basePath="/admin/whitelist"
            query={{ q, product }}
          />
        </div>
      )}
    </section>
  );
}
