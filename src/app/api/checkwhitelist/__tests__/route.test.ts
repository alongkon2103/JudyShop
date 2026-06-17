/**
 * Tests for the `/api/checkwhitelist` route handler.
 *
 * This is the surface that every Roblox game server hits, so the
 * handler MUST:
 *   1. Reject anonymous traffic before doing any work (rate limit by IP).
 *   2. Require a valid API key (constant-time compare).
 *   3. Validate the query (`username` required, lengths bounded).
 *   4. Forward to `checkWhitelist()` and reshape into the public JSON.
 *
 * We mock everything but the route file itself:
 *   - `@/lib/env`         → fake API key
 *   - `@/lib/whitelist`   → return canned results
 *   - `@/lib/rate-limit`  → controllable hit() / clientIp() responses
 *
 * Because `route.ts` reads `env.WHITELIST_API_KEY` lazily inside the
 * handler (via a try/catch), we can configure the mock per test.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: new Proxy({} as any, {
    get(_, key) {
      if (key === "WHITELIST_API_KEY") return "test-secret-key";
      return "stub";
    },
  }),
}));

vi.mock("@/lib/whitelist", () => ({
  checkWhitelist: vi.fn(),
  findUserWhitelistEntries: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  clientIp:           vi.fn(() => "1.2.3.4"),
  hit:                vi.fn(() => ({ ok: true, remaining: 100, resetIn: 60_000 })),
  retryAfterSeconds:  vi.fn((ms: number) => Math.ceil(ms / 1000)),
}));

import { GET } from "../route";
import { checkWhitelist, findUserWhitelistEntries } from "@/lib/whitelist";
import { hit } from "@/lib/rate-limit";

// ── Helpers ──────────────────────────────────────────────────

function makeReq(url: string, headers: Record<string, string> = {}) {
  // NextRequest is a subclass of Request — Node's built-in Request is
  // close enough for these handler tests. The route only reads
  // `headers.get()` and `nextUrl.searchParams` (via the `URL` parsing
  // we manually attach below).
  const req = new Request(url, { headers });
  // The route accesses `req.nextUrl.searchParams`; the easiest portable
  // way is to graft a `nextUrl` property onto the standard Request.
  (req as any).nextUrl = new URL(url);
  return req as any;
}

const VALID_KEY = "test-secret-key";

// ── Tests ────────────────────────────────────────────────────

describe("/api/checkwhitelist — auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hit).mockReturnValue({ ok: true, remaining: 100, resetIn: 60_000 });
  });

  it("returns 401 when no x-api-key header is set", async () => {
    const res = await GET(makeReq("http://localhost/api/checkwhitelist?username=foo"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/api key/i);
  });

  it("returns 401 when the x-api-key header is wrong", async () => {
    const res = await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=foo",
      { "x-api-key": "wrong-key" },
    ));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the api key length differs (safeEqual fast-path)", async () => {
    const res = await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=foo",
      { "x-api-key": "short" },
    ));
    expect(res.status).toBe(401);
  });

  it("never calls the DB lookup when auth fails", async () => {
    await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=foo",
      { "x-api-key": "wrong" },
    ));
    expect(checkWhitelist).not.toHaveBeenCalled();
  });
});

describe("/api/checkwhitelist — rate limit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 429 (with Retry-After header) when the IP bucket is exhausted", async () => {
    vi.mocked(hit).mockReturnValueOnce({ ok: false, remaining: 0, resetIn: 30_000 });
    const res = await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=foo",
      { "x-api-key": VALID_KEY },
    ));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    const body = await res.json();
    expect(body.error).toMatch(/rate limit/i);
    expect(body.retryAfterSec).toBe(30);
  });

  it("checks the IP bucket BEFORE checking the API key (defence-in-depth)", async () => {
    vi.mocked(hit).mockReturnValueOnce({ ok: false, remaining: 0, resetIn: 60_000 });
    // No api key — but rate-limit blocks first.
    const res = await GET(makeReq("http://localhost/api/checkwhitelist?username=foo"));
    expect(res.status).toBe(429);
    // Only the IP-bucket hit was called (not the key bucket).
    expect(hit).toHaveBeenCalledTimes(1);
    expect(vi.mocked(hit).mock.calls[0]![0]).toMatch(/^checkwl:ip:/);
  });

  it("checks the per-key bucket AFTER the API key passes", async () => {
    vi.mocked(hit)
      .mockReturnValueOnce({ ok: true, remaining: 50, resetIn: 60_000 })  // ip
      .mockReturnValueOnce({ ok: false, remaining: 0, resetIn: 10_000 }); // key
    const res = await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=foo",
      { "x-api-key": VALID_KEY },
    ));
    expect(res.status).toBe(429);
    expect(hit).toHaveBeenCalledTimes(2);
    expect(vi.mocked(hit).mock.calls[1]![0]).toMatch(/^checkwl:key:/);
  });
});

describe("/api/checkwhitelist — input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hit).mockReturnValue({ ok: true, remaining: 100, resetIn: 60_000 });
  });

  it("returns 400 when `username` query is missing", async () => {
    const res = await GET(makeReq(
      "http://localhost/api/checkwhitelist",
      { "x-api-key": VALID_KEY },
    ));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/username/i);
  });

  it("returns 400 when `username` is empty", async () => {
    const res = await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=",
      { "x-api-key": VALID_KEY },
    ));
    expect(res.status).toBe(400);
  });

  it("returns 400 when `username` exceeds 100 characters", async () => {
    const huge = "a".repeat(101);
    const res = await GET(makeReq(
      `http://localhost/api/checkwhitelist?username=${huge}`,
      { "x-api-key": VALID_KEY },
    ));
    expect(res.status).toBe(400);
  });
});

describe("/api/checkwhitelist — single-result path (with filter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hit).mockReturnValue({ ok: true, remaining: 100, resetIn: 60_000 });
  });

  it("returns 200 with the snake_case single envelope when productSlug is given", async () => {
    vi.mocked(checkWhitelist).mockResolvedValueOnce({
      status: "active",
      username: "judy_player",
      expiresAt: "2026-07-08T00:00:00.000Z",
      lifetime: false,
      duration: "30days",
      source: "stripe",
      trial: false,
      product: {
        id: "p1", slug: "demo", nameEn: "Demo Game", nameTh: "เกมเดโม", gameId: "12345",
      },
      checkedAt: "2026-06-08T10:00:00.000Z",
    });

    const res = await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=judy_player&productSlug=demo",
      { "x-api-key": VALID_KEY },
    ));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({
      status:     "active",
      username:   "judy_player",
      expires_at: "2026-07-08T00:00:00.000Z",
      lifetime:   false,
      duration:   "30days",
      source:     "stripe",
      trial:      false,
      product: {
        id:      "p1",
        slug:    "demo",
        name_en: "Demo Game",
        game_id: "12345",
      },
      checked_at: "2026-06-08T10:00:00.000Z",
    });
  });

  it("forwards trial=true + source='trial' through to the response", async () => {
    vi.mocked(checkWhitelist).mockResolvedValueOnce({
      status: "active",
      username: "judy_player",
      expiresAt: new Date(Date.now() + 8 * 60_000).toISOString(),
      lifetime: false,
      duration: "trial",
      source: "trial",
      trial: true,
      product: {
        id: "p1", slug: "demo", nameEn: "Demo", nameTh: "เดโม", gameId: "1",
      },
      checkedAt: "x",
    });
    const res = await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=judy_player&gameId=1",
      { "x-api-key": VALID_KEY },
    ));
    const body = await res.json();
    expect(body.trial).toBe(true);
    expect(body.source).toBe("trial");
    expect(body.duration).toBe("trial");
  });

  it("forwards productSlug to checkWhitelist when supplied", async () => {
    vi.mocked(checkWhitelist).mockResolvedValueOnce({
      status: "not_found", username: "foo", expiresAt: null, lifetime: false,
      duration: null, source: null, trial: false, product: null, checkedAt: "x",
    });
    await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=foo&productSlug=demo",
      { "x-api-key": VALID_KEY },
    ));
    expect(checkWhitelist).toHaveBeenCalledWith("foo", { productSlug: "demo", gameId: undefined });
    expect(findUserWhitelistEntries).not.toHaveBeenCalled();
  });

  it("forwards gameId to checkWhitelist when supplied", async () => {
    vi.mocked(checkWhitelist).mockResolvedValueOnce({
      status: "not_found", username: "foo", expiresAt: null, lifetime: false,
      duration: null, source: null, trial: false, product: null, checkedAt: "x",
    });
    await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=foo&gameId=12345",
      { "x-api-key": VALID_KEY },
    ));
    expect(checkWhitelist).toHaveBeenCalledWith("foo", { productSlug: undefined, gameId: "12345" });
    expect(findUserWhitelistEntries).not.toHaveBeenCalled();
  });

  it("returns `product: null` cleanly when the underlying row has no product link", async () => {
    vi.mocked(checkWhitelist).mockResolvedValueOnce({
      status: "not_found",
      username: "ghost",
      expiresAt: null,
      lifetime: false,
      duration: null,
      source: null,
      trial: false,
      product: null,
      checkedAt: "x",
    });
    const res = await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=ghost&gameId=99",
      { "x-api-key": VALID_KEY },
    ));
    expect((await res.json()).product).toBeNull();
  });
});

describe("/api/checkwhitelist — array path (no filter, all games)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hit).mockReturnValue({ ok: true, remaining: 100, resetIn: 60_000 });
  });

  it("returns every whitelist row the username has when no filter is given", async () => {
    vi.mocked(findUserWhitelistEntries).mockResolvedValueOnce({
      username: "judy_player",
      entries: [
        {
          status: "active", expiresAt: null, lifetime: true,
          duration: "permanent", source: "stripe", trial: false,
          product: { id: "p1", slug: "judy-legend", nameEn: "Judy Legend", nameTh: "จูดี้-เลเจนด์", gameId: "111" },
        },
        {
          status: "active", expiresAt: "2026-07-08T00:00:00.000Z", lifetime: false,
          duration: "30days", source: "stripe", trial: false,
          product: { id: "p2", slug: "judy-jump", nameEn: "Judy Jump", nameTh: "จูดี้-จัมพ์", gameId: "222" },
        },
      ],
    });

    const res = await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=judy_player",
      { "x-api-key": VALID_KEY },
    ));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Routes to the multi-entry fetcher, not the single-row one.
    expect(findUserWhitelistEntries).toHaveBeenCalledWith("judy_player");
    expect(checkWhitelist).not.toHaveBeenCalled();

    expect(body.status).toBe("found");
    expect(body.count).toBe(2);
    expect(body.username).toBe("judy_player");
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0]).toEqual({
      status: "active",
      expires_at: null,
      lifetime: true,
      duration: "permanent",
      source: "stripe",
      trial: false,
      product: { id: "p1", slug: "judy-legend", name_en: "Judy Legend", game_id: "111" },
    });
    expect(body.entries[1].product.slug).toBe("judy-jump");
  });

  it("returns status='not_found' + empty entries array when the username has no rows", async () => {
    vi.mocked(findUserWhitelistEntries).mockResolvedValueOnce({
      username: "ghost",
      entries: [],
    });
    const res = await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=ghost",
      { "x-api-key": VALID_KEY },
    ));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("not_found");
    expect(body.count).toBe(0);
    expect(body.entries).toEqual([]);
  });

  it("snake_cases per-entry product keys (id, slug, name_en, game_id)", async () => {
    vi.mocked(findUserWhitelistEntries).mockResolvedValueOnce({
      username: "judy",
      entries: [
        {
          status: "expired", expiresAt: "2025-01-01T00:00:00.000Z", lifetime: false,
          duration: "30days", source: "manual", trial: false,
          product: { id: "p", slug: "x", nameEn: "X game", nameTh: "เกมเอ็กซ์", gameId: null },
        },
      ],
    });
    const res = await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=judy",
      { "x-api-key": VALID_KEY },
    ));
    const body = await res.json();
    expect(body.entries[0].product).toEqual({
      id: "p", slug: "x", name_en: "X game", game_id: null,
    });
    // nameTh / camelCase keys should NOT leak through.
    expect(Object.keys(body.entries[0].product)).not.toContain("nameEn");
    expect(Object.keys(body.entries[0].product)).not.toContain("nameTh");
  });
});

describe("/api/checkwhitelist — server error path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hit).mockReturnValue({ ok: true, remaining: 100, resetIn: 60_000 });
  });

  it("returns 500 when the underlying lookup throws", async () => {
    // No filter → route uses findUserWhitelistEntries; mock that to fail.
    vi.mocked(findUserWhitelistEntries).mockRejectedValueOnce(new Error("DB exploded"));
    // Silence the route's console.error — the throw is intentional.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(makeReq(
      "http://localhost/api/checkwhitelist?username=foo",
      { "x-api-key": VALID_KEY },
    ));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal error.");
    errSpy.mockRestore();
  });
});
