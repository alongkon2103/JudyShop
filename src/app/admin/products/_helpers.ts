/**
 * Pure helpers shared by the product server actions.
 *
 * Lives in a SEPARATE file from `_actions.ts` because that file is
 * `"use server"` — Next.js requires every export from a server-action
 * module to be an async function. Synchronous helpers (parseGameId,
 * slugify, etc.) therefore live here.
 */

/**
 * Extract the Roblox place id from either:
 *   - a full URL ("https://www.roblox.com/games/12345678/Some-Game")
 *   - just digits   ("12345678")
 *   - empty         ("" → null)
 * Returns the Place ID digits, or null when nothing usable was provided.
 */
export function parseGameId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Roblox URL → extract the segment after "/games/".
  const urlMatch = trimmed.match(/\/games\/(\d+)/i);
  if (urlMatch) return urlMatch[1] ?? null;

  // Pure digits (with possible spaces / commas).
  const digitsOnly = trimmed.replace(/[^\d]/g, "");
  return digitsOnly.length > 0 ? digitsOnly : null;
}
