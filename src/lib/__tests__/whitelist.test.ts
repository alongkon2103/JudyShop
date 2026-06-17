/**
 * Tests for `checkWhitelist` — the lookup that powers `/api/checkwhitelist`,
 * which is what every Roblox game server calls when a player joins.
 *
 * The function must:
 *   - Return `"not_found"` for unknown / blank usernames.
 *   - Return `"active"` for live lifetime rows AND for rows with a
 *     future `expireDate`.
 *   - Return `"expired"` when `expireDate` is in the past (and not
 *     lifetime). Importantly, "exactly now" counts as expired —
 *     `expireDate > now` is strict.
 *   - Match usernames case-insensitively (Roblox usernames are
 *     case-preserving but compared case-insensitive in practice).
 *   - Optionally narrow by `productSlug` or `gameId`.
 *
 * As with `fulfilCheckout`, we mock the Prisma client at the module
 * boundary so the test suite stays hermetic.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db", () => ({
  db: { whitelist: { findFirst: vi.fn() } },
}));

import { checkWhitelist } from "../whitelist";
import { db } from "../db";

// ── Fixtures ─────────────────────────────────────────────────

function makeProduct(overrides: Partial<{
  id: string; slug: string; nameEn: string; nameTh: string; gameId: string | null;
}> = {}) {
  return {
    id: overrides.id ?? "prod-1",
    slug: overrides.slug ?? "demo-game",
    nameEn: overrides.nameEn ?? "Demo Game",
    nameTh: overrides.nameTh ?? "เกมเดโม",
    gameId: overrides.gameId ?? "12345678",
  };
}

function makeWhitelistRow(overrides: Partial<{
  id: string; username: string; expireDate: Date | null;
  isLifetime: boolean; createdAt: Date; product: any;
  source: "STRIPE" | "TRIAL" | "MANUAL" | "PROMO" | "REFUND_REVERT";
}> = {}) {
  return {
    id:         overrides.id ?? "wl-1",
    username:   overrides.username ?? "judy_player",
    productId:  "prod-1",
    expireDate: overrides.expireDate ?? null,
    isLifetime: overrides.isLifetime ?? false,
    createdAt:  overrides.createdAt ?? new Date("2026-01-01T00:00:00Z"),
    source:     overrides.source ?? "STRIPE",
    addedBy:    "stripe",
    product:    overrides.product ?? makeProduct(),
  };
}

beforeEach(() => vi.clearAllMocks());

// ── Tests ────────────────────────────────────────────────────

describe("checkWhitelist — empty / invalid username", () => {
  it("returns 'not_found' for an empty username without hitting the DB", async () => {
    const r = await checkWhitelist("");
    expect(r.status).toBe("not_found");
    expect(db.whitelist.findFirst).not.toHaveBeenCalled();
  });

  it("returns 'not_found' for whitespace-only input", async () => {
    const r = await checkWhitelist("   ");
    expect(r.status).toBe("not_found");
    expect(db.whitelist.findFirst).not.toHaveBeenCalled();
  });

  it("includes the (trimmed) username in the response shape", async () => {
    const r = await checkWhitelist("");
    expect(r).toMatchObject({
      status: "not_found",
      username: "",
      expiresAt: null,
      lifetime: false,
      duration: null,
      source: null,
      trial: false,
      product: null,
    });
    expect(typeof r.checkedAt).toBe("string");
  });
});

describe("checkWhitelist — trial source", () => {
  it("returns source='trial', trial=true, duration='trial' for an active TRIAL row", async () => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({
        source: "TRIAL",
        expireDate: new Date(Date.now() + 9 * 60 * 1000), // 9 min ahead
      }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.status).toBe("active");
    expect(r.source).toBe("trial");
    expect(r.trial).toBe(true);
    expect(r.duration).toBe("trial");
    // Sanity: 9 min would otherwise round to "1days" — make sure we
    // didn't fall through to formatDuration.
    expect(r.duration).not.toBe("1days");
  });

  it("returns source='trial' even when the trial has expired (Roblox still sees the label)", async () => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({
        source: "TRIAL",
        expireDate: new Date(Date.now() - 60 * 1000), // 1 min ago
      }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.status).toBe("expired");
    expect(r.source).toBe("trial");
    expect(r.trial).toBe(true);
  });

  it("returns source='stripe', trial=false for a normal paid row", async () => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({
        source: "STRIPE",
        expireDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.source).toBe("stripe");
    expect(r.trial).toBe(false);
  });

  it("lowercases the source enum (REFUND_REVERT → 'refund_revert')", async () => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({
        source: "REFUND_REVERT",
        expireDate: new Date(Date.now() + 1000),
      }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.source).toBe("refund_revert");
  });

  it("prefers 'permanent' over 'trial' if a row is somehow both lifetime AND trial-sourced", async () => {
    // Defensive — shouldn't happen, but if it ever does, lifetime wins
    // for human-friendly labelling.
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({
        source: "TRIAL",
        isLifetime: true,
        expireDate: null,
      }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.duration).toBe("permanent");
    expect(r.source).toBe("trial");
    expect(r.trial).toBe(true);
  });
});

describe("checkWhitelist — no row matched", () => {
  it("returns 'not_found' when the DB has no matching whitelist", async () => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(null);
    const r = await checkWhitelist("ghost_user");
    expect(r.status).toBe("not_found");
    expect(r.username).toBe("ghost_user");
    expect(r.lifetime).toBe(false);
    expect(r.product).toBeNull();
  });
});

describe("checkWhitelist — active rows", () => {
  it("returns 'active' for a lifetime row with no expiry", async () => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({ isLifetime: true, expireDate: null }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.status).toBe("active");
    expect(r.lifetime).toBe(true);
    expect(r.expiresAt).toBeNull();
    expect(r.duration).toBe("permanent");
  });

  it("returns 'active' for a row whose expireDate is in the future", async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({ expireDate: future }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.status).toBe("active");
    expect(r.lifetime).toBe(false);
    expect(r.expiresAt).toBe(future.toISOString());
  });

  it("exposes the product details (id, slug, names, gameId) when present", async () => {
    const future = new Date(Date.now() + 1000);
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({ expireDate: future }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.product).toEqual({
      id: "prod-1", slug: "demo-game",
      nameEn: "Demo Game", nameTh: "เกมเดโม",
      gameId: "12345678",
    });
  });
});

describe("checkWhitelist — expired rows", () => {
  it("returns 'expired' for a row whose expireDate is in the past", async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({ expireDate: past }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.status).toBe("expired");
    expect(r.expiresAt).toBe(past.toISOString());
  });

  it("treats expireDate === now as 'expired' (strict > comparison)", async () => {
    // Freeze time so the comparison is deterministic.
    vi.useFakeTimers();
    const fixedNow = new Date("2026-06-08T00:00:00Z");
    vi.setSystemTime(fixedNow);

    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({ expireDate: fixedNow }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.status).toBe("expired");

    vi.useRealTimers();
  });

  it("returns 'expired' (not 'not_found') for a non-lifetime row with expireDate=null", async () => {
    // Defensive: a malformed row with neither lifetime nor expiry — the
    // current implementation treats this as expired (isActive=false path).
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({ isLifetime: false, expireDate: null }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.status).toBe("expired");
  });
});

describe("checkWhitelist — case-insensitive matching", () => {
  it("passes the username to Prisma with mode: 'insensitive'", async () => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(null);
    await checkWhitelist("JuDy_PlAyEr");

    const where = vi.mocked(db.whitelist.findFirst).mock.calls[0]![0]!.where!;
    expect(where).toMatchObject({
      username: { equals: "JuDy_PlAyEr", mode: "insensitive" },
    });
  });

  it("returns the username as it was stored in the DB (not as queried)", async () => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({ username: "Judy_Player", isLifetime: true }) as any,
    );
    const r = await checkWhitelist("judy_player"); // queried lowercase
    expect(r.username).toBe("Judy_Player"); // returned as stored
  });
});

describe("checkWhitelist — product filtering", () => {
  beforeEach(() => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValue(null);
  });

  it("narrows by productSlug when provided", async () => {
    await checkWhitelist("judy_player", { productSlug: "my-game" });
    const where = vi.mocked(db.whitelist.findFirst).mock.calls[0]![0]!.where!;
    expect(where).toMatchObject({ product: { slug: "my-game" } });
  });

  it("narrows by gameId when provided", async () => {
    await checkWhitelist("judy_player", { gameId: "987654" });
    const where = vi.mocked(db.whitelist.findFirst).mock.calls[0]![0]!.where!;
    expect(where).toMatchObject({ product: { gameId: "987654" } });
  });

  it("prefers productSlug over gameId when both are provided", async () => {
    await checkWhitelist("judy_player", { productSlug: "a", gameId: "b" });
    const where = vi.mocked(db.whitelist.findFirst).mock.calls[0]![0]!.where!;
    expect(where).toMatchObject({ product: { slug: "a" } });
    // gameId should NOT appear once slug is set.
    expect((where as any).product.gameId).toBeUndefined();
  });

  it("does not include a product filter when neither is provided", async () => {
    await checkWhitelist("judy_player");
    const where = vi.mocked(db.whitelist.findFirst).mock.calls[0]![0]!.where!;
    expect((where as any).product).toBeUndefined();
  });
});

describe("checkWhitelist — orderBy / 'best match wins'", () => {
  it("orders results by lifetime desc, then expireDate desc (latest first)", async () => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(null);
    await checkWhitelist("judy_player");
    const orderBy = vi.mocked(db.whitelist.findFirst).mock.calls[0]![0]!.orderBy!;
    expect(orderBy).toEqual([{ isLifetime: "desc" }, { expireDate: "desc" }]);
  });
});

describe("checkWhitelist — `duration` label", () => {
  it("returns 'permanent' for lifetime", async () => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({ isLifetime: true }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.duration).toBe("permanent");
  });

  it("returns '30days' for a 30-day gap between createdAt and expireDate", async () => {
    const createdAt = new Date("2026-06-01T00:00:00Z");
    const expireDate = new Date("2026-07-01T00:00:00Z"); // exactly 30 days
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({ createdAt, expireDate }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.duration).toBe("30days");
  });

  it("returns '7days' for a 7-day gap", async () => {
    const createdAt = new Date("2026-06-01T00:00:00Z");
    const expireDate = new Date("2026-06-08T00:00:00Z");
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({ createdAt, expireDate }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.duration).toBe("7days");
  });

  it("returns a generic 'Nd' label for non-canonical durations", async () => {
    const createdAt = new Date("2026-06-01T00:00:00Z");
    const expireDate = new Date("2026-06-16T00:00:00Z"); // 15 days
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({ createdAt, expireDate }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.duration).toBe("15days");
  });

  it("returns null when there is no expireDate and not lifetime", async () => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(
      makeWhitelistRow({ isLifetime: false, expireDate: null }) as any,
    );
    const r = await checkWhitelist("judy_player");
    expect(r.duration).toBeNull();
  });
});

describe("checkWhitelist — response shape", () => {
  it("always exposes `checkedAt` as an ISO string", async () => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(null);
    const r = await checkWhitelist("anybody");
    // Cheap shape check — must parse back to a Date.
    expect(Number.isFinite(Date.parse(r.checkedAt))).toBe(true);
  });

  it("never returns `undefined` for top-level fields", async () => {
    vi.mocked(db.whitelist.findFirst).mockResolvedValueOnce(null);
    const r = await checkWhitelist("anybody");
    for (const k of Object.keys(r) as (keyof typeof r)[]) {
      expect(r[k]).not.toBeUndefined();
    }
  });
});
