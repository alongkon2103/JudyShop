import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  /** Current page (1-indexed). */
  page: number;
  /** Total rows across all pages. */
  total: number;
  /** Rows per page. */
  pageSize: number;
  /** Base path without query (e.g. "/admin/whitelist"). */
  basePath: string;
  /** Preserve other query params (e.g. q, product, status). */
  query?: Record<string, string | undefined>;
  /** Optional label override for the "Showing X-Y of Z" copy. */
  label?: (start: number, end: number, total: number) => string;
};

/**
 * URL-driven pagination for admin tables.
 *
 * Why URL-driven (not state)?  Admins frequently bookmark / share links
 * to specific rows ("look at this whitelist entry on page 3"); driving
 * from `?page=N` keeps those links portable, lets the browser Back/
 * Forward work naturally, and Server Components can read `searchParams`
 * directly — no client state needed.
 */
export function Pagination({ page, total, pageSize, basePath, query, label }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = clampPage(page, totalPages);

  // Render nothing when everything fits on one page — no value in showing
  // "1 of 1" pagination chrome.
  if (totalPages <= 1) return null;

  const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const end   = Math.min(current * pageSize, total);

  const prevHref = current > 1 ? hrefFor(basePath, query, current - 1) : null;
  const nextHref = current < totalPages ? hrefFor(basePath, query, current + 1) : null;

  // For the page-number list we show: 1 … (current-1) current (current+1) … last
  const pages = buildPageList(current, totalPages);

  const summary = (label ?? defaultLabel)(start, end, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line-light px-4 py-3 text-[12px] text-fg-light-soft"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.08em]">{summary}</p>
      <ul className="flex items-center gap-1">
        <li>
          <PageLink
            href={prevHref}
            aria-label="Previous page"
            disabled={!prevHref}
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
          </PageLink>
        </li>
        {pages.map((p, idx) =>
          p === "…" ? (
            <li key={`gap-${idx}`} className="px-2 text-fg-light-mute">…</li>
          ) : (
            <li key={p}>
              <PageLink
                href={p === current ? null : hrefFor(basePath, query, p)}
                active={p === current}
                disabled={p === current}
                aria-current={p === current ? "page" : undefined}
                aria-label={`Page ${p}`}
              >
                {p}
              </PageLink>
            </li>
          ),
        )}
        <li>
          <PageLink
            href={nextHref}
            aria-label="Next page"
            disabled={!nextHref}
          >
            <ChevronRight size={14} strokeWidth={2.5} />
          </PageLink>
        </li>
      </ul>
    </nav>
  );
}

// ── Internals ────────────────────────────────────────────────────

function defaultLabel(start: number, end: number, total: number): string {
  return `Showing ${start}-${end} of ${total}`;
}

function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(totalPages, Math.floor(page));
}

function hrefFor(basePath: string, query: Props["query"], page: number): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v && v.length) params.set(k, v);
    }
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Build a compact list of page numbers around the current page.
 *   1 2 3 ... 9          (near start)
 *   1 ... 4 5 6 ... 9    (middle)
 *   1 ... 7 8 9          (near end)
 */
function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const left  = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) out.push("…");
  for (let p = left; p <= right; p++) out.push(p);
  if (right < total - 1) out.push("…");
  out.push(total);
  return out;
}

function PageLink({
  href,
  active,
  disabled,
  children,
  ...rest
}: {
  href: string | null;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
} & React.AriaAttributes) {
  const className = cn(
    "grid h-8 min-w-[2rem] place-items-center rounded-md px-2 font-mono text-[11px] font-bold transition-colors",
    active
      ? "bg-pink-500 text-white"
      : disabled
        ? "text-fg-light-mute"
        : "text-fg-light-soft hover:bg-paper-2 hover:text-fg-light",
  );
  if (!href) {
    return (
      <span aria-disabled={disabled ? true : undefined} className={className} {...rest}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}
