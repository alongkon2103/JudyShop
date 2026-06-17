/**
 * Roblox public-API helpers.
 *
 * We hit two unauthenticated endpoints:
 *   1. users.roblox.com/v1/usernames/users
 *      → resolves a username to a Roblox `userId` + `displayName`.
 *   2. thumbnails.roblox.com/v1/users/avatar-headshot
 *      → returns a CDN avatar URL for that userId.
 *
 * Both are public, rate-limited by Roblox. We don't cache here because
 * the calling action runs on demand from a debounced UI input — and a
 * username change should reflect immediately. Add a layer if traffic
 * grows.
 *
 * Used to power the "preview before paying" confirmation in
 * ProductModal so customers don't pay for a typo of their own name.
 */
const USERS_API = "https://users.roblox.com/v1/usernames/users";
const AVATAR_API = "https://thumbnails.roblox.com/v1/users/avatar-headshot";

export type RobloxUser = {
  id: number;
  username: string;     // canonical username from Roblox (case-preserving)
  displayName: string;
  avatarUrl: string | null;
};

export type LookupResult =
  | { ok: true;  user: RobloxUser }
  | { ok: false; reason: "not_found" | "network" | "invalid" };

/** Roblox username spec: 3–20 chars, letters/digits/underscore, no double-underscore, can't start/end with `_`. */
const USERNAME_RE = /^(?!.*__)(?!_)(?!.*_$)[A-Za-z0-9_]{3,20}$/;

export function isPlausibleUsername(s: string): boolean {
  return USERNAME_RE.test(s.trim());
}

export async function lookupRobloxUser(rawUsername: string): Promise<LookupResult> {
  const username = rawUsername.trim();
  if (!isPlausibleUsername(username)) return { ok: false, reason: "invalid" };

  let userId: number;
  let canonicalUsername: string;
  let displayName: string;
  try {
    const res = await fetch(USERS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
      // Roblox's API is fast; if it stalls > 6s assume bad weather.
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return { ok: false, reason: "network" };
    const json = (await res.json()) as { data?: Array<{ id: number; name: string; displayName: string }> };
    const hit = json.data?.[0];
    if (!hit) return { ok: false, reason: "not_found" };
    userId = hit.id;
    canonicalUsername = hit.name;
    displayName = hit.displayName ?? hit.name;
  } catch {
    return { ok: false, reason: "network" };
  }

  // Avatar is best-effort — we still return the user even if the avatar
  // endpoint hiccups.
  let avatarUrl: string | null = null;
  try {
    const url = `${AVATAR_API}?userIds=${userId}&size=150x150&format=Png`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ imageUrl?: string; state?: string }> };
      const hit = json.data?.[0];
      if (hit?.state === "Completed" && hit.imageUrl) avatarUrl = hit.imageUrl;
    }
  } catch {
    // swallow — avatar is optional
  }

  return {
    ok: true,
    user: { id: userId, username: canonicalUsername, displayName, avatarUrl },
  };
}
