/**
 * Validate a `?next=` style redirect target so we never bounce the user
 * to an external domain. Returns the path when safe, or the fallback
 * otherwise.
 *
 * Accepts:   "/admin", "/admin/products", "/admin?q=1"
 * Rejects:   "https://evil.com", "//evil.com", "javascript:alert(1)",
 *            relative paths without a leading "/", empty strings.
 */
export function safeNextPath(
  candidate: string | null | undefined,
  fallback = "/admin",
): string {
  if (!candidate || typeof candidate !== "string") return fallback;
  const trimmed = candidate.trim();

  // Must be an internal absolute path: starts with a single "/".
  if (!trimmed.startsWith("/")) return fallback;
  // "//evil.com" is a protocol-relative URL — reject.
  if (trimmed.startsWith("//")) return fallback;
  // Disallow any backslashes — some browsers normalise "\\" → "//".
  if (trimmed.includes("\\")) return fallback;
  // Hard cap to keep cookies / referer fields predictable.
  if (trimmed.length > 512) return fallback;

  return trimmed;
}
