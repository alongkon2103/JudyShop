/**
 * Shared whitelist status filter — used by BOTH the admin whitelist page
 * and the partner whitelist page so the two never drift apart on what
 * "active / expired / lifetime" means.
 *
 * Default is "all": landing on either page with no `status` query shows
 * every entry (active + expired + lifetime); the operator narrows down
 * from there via the dropdown.
 */
export type WhitelistStatus = "active" | "expired" | "lifetime" | "all";

export const WHITELIST_STATUSES: { value: WhitelistStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "lifetime", label: "Lifetime" },
];

/** Coerce a raw query value to a known status, defaulting to "all". */
export function normalizeWhitelistStatus(raw: string | undefined): WhitelistStatus {
  return raw === "active" || raw === "expired" || raw === "lifetime" ? raw : "all";
}

/**
 * Prisma `WhitelistWhereInput` fragment for a status. Returns `{}` for
 * "all" so it can be spread into a larger where clause unconditionally.
 *   - active   = lifetime OR not-yet-expired
 *   - expired  = timed AND past its expiry
 *   - lifetime = never expires
 */
export function whitelistStatusWhere(status: WhitelistStatus, now: Date) {
  switch (status) {
    case "active":
      return { OR: [{ isLifetime: true }, { expireDate: { gt: now } }] };
    case "expired":
      return { isLifetime: false, expireDate: { lte: now } };
    case "lifetime":
      return { isLifetime: true };
    case "all":
    default:
      return {};
  }
}
