/**
 * Whitelist lookup — used by the public /api/checkwhitelist endpoint
 * and (later) by the admin Whitelist page.
 *
 * Username matching is case-insensitive. When multiple entries exist
 * for a (productId, username) pair (which the unique index prevents),
 * lifetime > furthest expiry wins.
 */
import { db } from "./db";

export type WhitelistStatus = "active" | "expired" | "not_found";

/** Lowercased mirror of the DB `WhitelistSource` enum. */
export type WhitelistSourceKey =
  | "stripe"
  | "trial"
  | "manual"
  | "promo"
  | "refund_revert";

export type WhitelistCheck = {
  status: WhitelistStatus;
  username: string;
  /** ISO datetime when the whitelist expires. `null` for lifetime / not found. */
  expiresAt: string | null;
  lifetime: boolean;
  /** Human label: "permanent" | "trial" | "30days" | "Nd" (computed) | null. */
  duration: string | null;
  /** Where this access came from. `null` only when status=not_found. */
  source: WhitelistSourceKey | null;
  /** Shortcut for `source === "trial"` — keeps Roblox-side code terse. */
  trial: boolean;
  product: { id: string; slug: string; nameEn: string; nameTh: string; gameId: string | null } | null;
  checkedAt: string;
};

type Opts = {
  /** Restrict to a single product by its slug. */
  productSlug?: string | null;
  /** Restrict to a single Roblox game/place id (Product.gameId). */
  gameId?: string | null;
};

export async function checkWhitelist(
  username: string,
  opts: Opts = {},
): Promise<WhitelistCheck> {
  const checkedAt = new Date().toISOString();
  const trimmed = username.trim();

  if (!trimmed) {
    return {
      status: "not_found",
      username: trimmed,
      expiresAt: null,
      lifetime: false,
      duration: null,
      source: null,
      trial: false,
      product: null,
      checkedAt,
    };
  }

  const productFilter =
    opts.productSlug ? { slug: opts.productSlug } :
    opts.gameId     ? { gameId: opts.gameId }     : undefined;

  const row = await db.whitelist.findFirst({
    where: {
      username: { equals: trimmed, mode: "insensitive" },
      ...(productFilter && { product: productFilter }),
    },
    include: {
      product: { select: { id: true, slug: true, nameEn: true, nameTh: true, gameId: true } },
    },
    // Best match first: lifetime, then furthest expiry.
    orderBy: [{ isLifetime: "desc" }, { expireDate: "desc" }],
  });

  if (!row) {
    return {
      status: "not_found",
      username: trimmed,
      expiresAt: null,
      lifetime: false,
      duration: null,
      source: null,
      trial: false,
      product: null,
      checkedAt,
    };
  }

  const now = new Date();
  const isActive = row.isLifetime || (row.expireDate ? row.expireDate > now : false);
  const source = row.source.toLowerCase() as WhitelistSourceKey;
  const isTrial = source === "trial";

  return {
    status: isActive ? "active" : "expired",
    username: row.username,
    expiresAt: row.expireDate ? row.expireDate.toISOString() : null,
    lifetime: row.isLifetime,
    duration: row.isLifetime
      ? "permanent"
      : isTrial
        ? "trial"
        : row.expireDate
          ? formatDuration(row.expireDate, row.createdAt)
          : null,
    source,
    trial: isTrial,
    product: row.product
      ? {
          id: row.product.id,
          slug: row.product.slug,
          nameEn: row.product.nameEn,
          nameTh: row.product.nameTh,
          gameId: row.product.gameId,
        }
      : null,
    checkedAt,
  };
}

function formatDuration(expireDate: Date, addedAt: Date): string {
  const ms = expireDate.getTime() - addedAt.getTime();
  const days = Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));
  if (days === 30) return "30days";
  if (days === 7) return "7days";
  return `${days}days`;
}

// ── Multi-entry lookup (used by the API-key-gated /api/checkwhitelist) ──

export type UserWhitelistEntry = {
  status: "active" | "expired";
  expiresAt: string | null;
  lifetime: boolean;
  /** Computed label: "permanent" | "trial" | "Nd" — same vocabulary as
   *  the single-result endpoint so Roblox-side code can switch on it. */
  duration: string | null;
  source: WhitelistSourceKey;
  /** Shortcut for `source === "trial"`. */
  trial: boolean;
  product: {
    id: string;
    slug: string;
    nameEn: string;
    nameTh: string;
    gameId: string | null;
  };
};

/**
 * Find EVERY whitelist row a username has, across all products.
 *
 * The single-result `checkWhitelist()` is built for the Roblox runtime
 * API — there it knows exactly which game is asking (via gameId) and
 * just wants a yes/no for that one. This multi-entry shape exists for
 * admin tooling that needs the full picture for a username across all
 * products in one call.
 *
 * Ordering: lifetime first, then furthest expiry — so the most-useful
 * entry appears at the top of the list.
 */
export async function findUserWhitelistEntries(
  username: string,
  opts: { productSlug?: string | null } = {},
): Promise<{ username: string; entries: UserWhitelistEntry[] }> {
  const trimmed = username.trim();
  if (!trimmed) return { username: trimmed, entries: [] };

  const rows = await db.whitelist.findMany({
    where: {
      username: { equals: trimmed, mode: "insensitive" },
      ...(opts.productSlug && { product: { slug: opts.productSlug } }),
    },
    include: {
      product: { select: { id: true, slug: true, nameEn: true, nameTh: true, gameId: true } },
    },
    orderBy: [
      { isLifetime: "desc" },
      { expireDate: "desc" },
    ],
  });

  const now = new Date();
  // Use the username as written in the DB (which preserves the user's
  // own casing) rather than what they typed in the search box.
  const canonicalUsername = rows[0]?.username ?? trimmed;

  return {
    username: canonicalUsername,
    entries: rows.map((row): UserWhitelistEntry => {
      const source = row.source.toLowerCase() as WhitelistSourceKey;
      const isTrial = source === "trial";
      return {
        status:
          row.isLifetime || (row.expireDate && row.expireDate > now)
            ? "active"
            : "expired",
        expiresAt: row.expireDate ? row.expireDate.toISOString() : null,
        lifetime: row.isLifetime,
        duration: row.isLifetime
          ? "permanent"
          : isTrial
            ? "trial"
            : row.expireDate
              ? formatDuration(row.expireDate, row.createdAt)
              : null,
        source,
        trial: isTrial,
        product: {
          id: row.product.id,
          slug: row.product.slug,
          nameEn: row.product.nameEn,
          nameTh: row.product.nameTh,
          gameId: row.product.gameId,
        },
      };
    }),
  };
}
