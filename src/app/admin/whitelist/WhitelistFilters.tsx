"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

type Product = { id: string; nameEn: string };

type Props = {
  initialQ: string;
  initialProduct: string;
  products: Product[];
};

const DEBOUNCE_MS = 300;

/**
 * Live-filter for the whitelist table. Typing in the search box or
 * changing the product dropdown updates the URL via `router.replace`
 * after a 300 ms debounce, which re-runs the server component without
 * a full page navigation (no scroll jump, no history spam).
 *
 * Page resets to 1 on any filter change so the admin doesn't end up on
 * page 7 of a result set that only has 2 pages.
 */
export function WhitelistFilters({ initialQ, initialProduct, products }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [product, setProduct] = useState(initialProduct);
  const [pending, startTransition] = useTransition();

  // Debounce timer + a ref to the latest values so the trailing fire
  // sees what the user actually has now (not whatever was current when
  // the timer was started).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ q, product });
  latestRef.current = { q, product };

  // Resync if the URL is changed by something else (Reset link, browser
  // back). Keeps the input in sync without fighting user typing.
  useEffect(() => { setQ(initialQ); }, [initialQ]);
  useEffect(() => { setProduct(initialProduct); }, [initialProduct]);

  const push = (next: { q: string; product: string }) => {
    const params = new URLSearchParams();
    if (next.q.trim())   params.set("q", next.q.trim());
    if (next.product)    params.set("product", next.product);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/admin/whitelist?${qs}` : "/admin/whitelist", { scroll: false });
    });
  };

  const scheduleFilter = (delayMs: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => push(latestRef.current), delayMs);
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const onSearchChange = (value: string) => {
    setQ(value);
    scheduleFilter(DEBOUNCE_MS);
  };

  const onProductChange = (value: string) => {
    setProduct(value);
    // Dropdown is an explicit, intentional choice — fire immediately.
    if (timerRef.current) clearTimeout(timerRef.current);
    push({ q: latestRef.current.q, product: value });
  };

  const clearAll = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setQ("");
    setProduct("");
    push({ q: "", product: "" });
  };

  const hasFilters = q.trim() || product;

  return (
    <div className="panel flex flex-wrap items-center gap-2 rounded-xl p-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search
          size={14}
          strokeWidth={2.25}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-light-mute"
        />
        <input
          type="text"
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search username, email, label, product, source…"
          aria-label="Search whitelist"
          className="w-full rounded-md border border-line-light bg-paper-2 py-2.5 pl-9 pr-9 text-[13px] text-fg-light focus:border-pink-400 focus:outline-none focus:ring-4 focus:ring-pink-400/15"
        />
        {pending ? (
          <Loader2
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-pink-400"
          />
        ) : q ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-fg-light-mute hover:bg-paper-2 hover:text-fg-light"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        ) : null}
      </div>

      <select
        value={product}
        onChange={(e) => onProductChange(e.target.value)}
        aria-label="Filter by product"
        className="rounded-md border border-line-light bg-paper-2 px-3 py-2.5 text-[13px] text-fg-light"
      >
        <option value="">All products</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>{p.nameEn}</option>
        ))}
      </select>

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="rounded-md border border-line-light px-3 py-2.5 text-[11px] font-semibold text-fg-light-soft hover:bg-paper-2"
        >
          Reset
        </button>
      )}
    </div>
  );
}
