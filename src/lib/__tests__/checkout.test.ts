/**
 * Tests for `fulfilCheckout` — the renewal/extension logic that runs
 * after every successful Stripe payment. This is THE single function
 * that decides what whitelist a paying customer ends up with, so its
 * correctness is load-bearing for the whole business.
 *
 * Rules under test (cross-reference src/lib/checkout.ts):
 *
 *   1. Order is upserted on `stripeSessionId` — replaying the same
 *      Stripe session must never create a duplicate order.
 *   2. Whitelist is upserted on `(productId, username)` — a customer
 *      buying again gets ONE row, not two.
 *   3. Duration arithmetic:
 *        - If the existing whitelist is still in-window → expireDate
 *          extends from the existing expiry (so they aren't punished
 *          for renewing early).
 *        - If expired (or no whitelist yet) → starts from "now".
 *        - Lifetime sticks: once isLifetime=true, never downgrade.
 *        - A lifetime plan upgrades a previously time-limited row.
 *   4. Order ↔ Whitelist linkage: `orderId` set on the whitelist row.
 *   5. Missing metadata → throws (we'd rather fail loud than store
 *      garbage).
 *
 * The Prisma client is mocked at the module boundary — these tests
 * never touch a real database. Each test seeds the mocks via factory
 * helpers and asserts the EXACT shape of the args passed to upsert.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the env reader BEFORE anything imports it — otherwise loading
// `../stripe` (which is imported by `../checkout`) blows up looking for
// STRIPE_SECRET_KEY in process.env.
vi.mock("../env", () => ({
  env: new Proxy({}, { get: () => "test-env-stub" }),
}));

// Mock the Stripe client. fulfilCheckout never actually calls into it
// (the webhook / success-page wrappers do), but it's imported at module
// load so we still need a stub.
vi.mock("../stripe", () => ({ stripe: {} }));

vi.mock("../db", () => {
  // `fulfilCheckout` now wraps Order + Whitelist writes in
  // `db.$transaction(async (tx) => …)`. The mock implementation just
  // passes our top-level `db` object back as the `tx` argument, so
  // calls like `tx.order.upsert(...)` route through to the same
  // `vi.fn()` mocks that existing tests are already asserting on.
  const db: any = {
    plan:      { findUnique: vi.fn() },
    order:     { upsert:     vi.fn() },
    whitelist: { findUnique: vi.fn(), upsert: vi.fn() },
    setting:   { upsert:     vi.fn() }, // unused by fulfilCheckout but resolves the import
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn: any) =>
    typeof fn === "function" ? fn(db) : Promise.all(fn),
  );
  return { db };
});

import { fulfilCheckout } from "../checkout";
import { db } from "../db";

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Fixture factories ────────────────────────────────────────

function makePlan(overrides: Partial<{
  id: string; productId: string; durationDays: number | null; isLifetime: boolean;
}> = {}) {
  // Use `'key' in overrides` rather than `??` so callers can pass an
  // explicit `null` for `durationDays` (otherwise `null ?? 30` would
  // silently turn it back into 30 and mask the test).
  return {
    id: "id" in overrides ? overrides.id : "plan-30d",
    productId: overrides.productId ?? "prod-1",
    isLifetime: overrides.isLifetime ?? false,
    durationDays: "durationDays" in overrides ? overrides.durationDays : 30,
    priceUSD: 9.99,
    priceTHB: 350,
    labelEn: "30 days", labelTh: "30 วัน",
    badge: null, displayOrder: 0, isActive: true,
    product: {
      id: overrides.productId ?? "prod-1",
      nameEn: "Demo Game", nameTh: "เกมเดโม",
      isActive: true, comingSoon: false,
    },
  };
}

function makeExistingWhitelist(overrides: Partial<{
  id: string; expireDate: Date | null; isLifetime: boolean;
}> = {}) {
  return {
    id:         overrides.id ?? "wl-1",
    productId:  "prod-1",
    username:   "judy_player",
    expireDate: overrides.expireDate ?? null,
    isLifetime: overrides.isLifetime ?? false,
    source:     "STRIPE" as const,
    addedBy:    "stripe",
    orderId:    null,
  };
}

const BASE_ARGS = {
  stripeSessionId: "cs_test_123",
  stripePaymentId: "pi_test_123",
  metadata: { productId: "prod-1", planId: "plan-30d", username: "judy_player" },
  amountTotal: 35000, // 350.00 THB in satang
  currency: "thb",
  paymentMethod: "CARD" as const,
};

// ── Tests ────────────────────────────────────────────────────

describe("fulfilCheckout — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws if productId is missing from metadata", async () => {
    await expect(
      fulfilCheckout({ ...BASE_ARGS, metadata: { planId: "p", username: "u" } }),
    ).rejects.toThrow(/productId/);
  });

  it("throws if planId is missing", async () => {
    await expect(
      fulfilCheckout({ ...BASE_ARGS, metadata: { productId: "p", username: "u" } }),
    ).rejects.toThrow(/planId/);
  });

  it("throws if username is missing", async () => {
    await expect(
      fulfilCheckout({ ...BASE_ARGS, metadata: { productId: "p", planId: "x" } }),
    ).rejects.toThrow(/username/);
  });

  it("throws if the plan no longer exists in the DB", async () => {
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(null);
    await expect(fulfilCheckout(BASE_ARGS)).rejects.toThrow(/Plan .* not found/);
  });
});

describe("fulfilCheckout — Order upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.plan.findUnique).mockResolvedValue(makePlan() as any);
    vi.mocked(db.whitelist.findUnique).mockResolvedValue(null);
    vi.mocked(db.order.upsert).mockResolvedValue({ id: "order-1" } as any);
    vi.mocked(db.whitelist.upsert).mockResolvedValue({ id: "wl-new" } as any);
  });

  it("upserts on stripeSessionId (idempotency key)", async () => {
    await fulfilCheckout(BASE_ARGS);
    expect(db.order.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSessionId: "cs_test_123" },
      }),
    );
  });

  it("converts satang (Stripe's smallest unit) to THB on the Order amount", async () => {
    await fulfilCheckout({ ...BASE_ARGS, amountTotal: 35000 });
    const call = vi.mocked(db.order.upsert).mock.calls[0]![0];
    expect(call.create.amount).toBe(350);
    expect(call.update.amount).toBe(350);
  });

  it("treats amountTotal=null as 0 (defensive)", async () => {
    await fulfilCheckout({ ...BASE_ARGS, amountTotal: null });
    const call = vi.mocked(db.order.upsert).mock.calls[0]![0];
    expect(call.create.amount).toBe(0);
  });

  it("uppercases the currency on storage", async () => {
    await fulfilCheckout({ ...BASE_ARGS, currency: "thb" });
    const call = vi.mocked(db.order.upsert).mock.calls[0]![0];
    expect(call.create.currency).toBe("THB");
  });

  it("falls back to 'THB' when Stripe omits the currency", async () => {
    await fulfilCheckout({ ...BASE_ARGS, currency: null });
    const call = vi.mocked(db.order.upsert).mock.calls[0]![0];
    expect(call.create.currency).toBe("THB");
  });

  it("stamps status=PAID on both create and update branches", async () => {
    await fulfilCheckout(BASE_ARGS);
    const call = vi.mocked(db.order.upsert).mock.calls[0]![0];
    expect(call.create.status).toBe("PAID");
    expect(call.update.status).toBe("PAID");
  });

  it("propagates the chosen payment method", async () => {
    await fulfilCheckout({ ...BASE_ARGS, paymentMethod: "PROMPTPAY" });
    const call = vi.mocked(db.order.upsert).mock.calls[0]![0];
    expect(call.create.paymentMethod).toBe("PROMPTPAY");
  });
});

describe("fulfilCheckout — Whitelist · brand-new customer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.order.upsert).mockResolvedValue({ id: "order-new" } as any);
    vi.mocked(db.whitelist.findUnique).mockResolvedValue(null); // no existing row
  });

  it("creates a whitelist row that expires in `durationDays` for a duration plan", async () => {
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(
      makePlan({ durationDays: 30 }) as any,
    );
    const before = Date.now();
    await fulfilCheckout(BASE_ARGS);
    const after = Date.now();

    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    expect(call.create.isLifetime).toBe(false);
    expect(call.create.expireDate).toBeInstanceOf(Date);

    const expiryMs = (call.create.expireDate as Date).getTime();
    // Should be ~30 days from the moment we called fulfilCheckout. Allow
    // small jitter for timer drift between `Date.now()` snapshots.
    expect(expiryMs).toBeGreaterThanOrEqual(before + 30 * DAY_MS - 100);
    expect(expiryMs).toBeLessThanOrEqual(after + 30 * DAY_MS + 100);
  });

  it("creates a lifetime whitelist (no expiry) for a lifetime plan", async () => {
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(
      makePlan({ isLifetime: true, durationDays: null }) as any,
    );
    await fulfilCheckout(BASE_ARGS);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    expect(call.create.isLifetime).toBe(true);
    expect(call.create.expireDate).toBeNull();
  });

  it("links the new whitelist row to the freshly-created Order via orderId", async () => {
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(makePlan() as any);
    vi.mocked(db.order.upsert).mockResolvedValueOnce({ id: "order-link-1" } as any);
    await fulfilCheckout(BASE_ARGS);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    expect(call.create.orderId).toBe("order-link-1");
  });

  it("matches the whitelist by composite key (productId, username)", async () => {
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(makePlan() as any);
    await fulfilCheckout(BASE_ARGS);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    expect(call.where).toEqual({
      productId_username: { productId: "prod-1", username: "judy_player" },
    });
  });

  it("sources the row as 'STRIPE'", async () => {
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(makePlan() as any);
    await fulfilCheckout(BASE_ARGS);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    expect(call.create.source).toBe("STRIPE");
    expect(call.create.addedBy).toBe("stripe");
  });
});

describe("fulfilCheckout — Whitelist · returning customer (extension)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.order.upsert).mockResolvedValue({ id: "order-renew" } as any);
  });

  it("extends from the existing expiry when the customer renews EARLY (still in window)", async () => {
    const futureExpiry = new Date(Date.now() + 10 * DAY_MS); // 10 days left
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(
      makePlan({ durationDays: 30 }) as any,
    );
    vi.mocked(db.whitelist.findUnique).mockResolvedValueOnce(
      makeExistingWhitelist({ expireDate: futureExpiry }) as any,
    );

    await fulfilCheckout(BASE_ARGS);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];

    // Should be old expiry + 30 days, NOT "now" + 30 days.
    const expected = new Date(futureExpiry.getTime() + 30 * DAY_MS);
    expect((call.update.expireDate as Date).getTime()).toBe(expected.getTime());
  });

  it("starts from NOW when the customer renews AFTER expiry", async () => {
    const pastExpiry = new Date(Date.now() - 5 * DAY_MS); // expired 5 days ago
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(
      makePlan({ durationDays: 30 }) as any,
    );
    vi.mocked(db.whitelist.findUnique).mockResolvedValueOnce(
      makeExistingWhitelist({ expireDate: pastExpiry }) as any,
    );

    const before = Date.now();
    await fulfilCheckout(BASE_ARGS);
    const after = Date.now();

    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    const ms = (call.update.expireDate as Date).getTime();
    expect(ms).toBeGreaterThanOrEqual(before + 30 * DAY_MS - 100);
    expect(ms).toBeLessThanOrEqual(after + 30 * DAY_MS + 100);
  });

  it("starts from NOW when the existing expiry equals now (boundary)", async () => {
    // expireDate > now is the renewal condition — equality counts as expired.
    const now = new Date();
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(
      makePlan({ durationDays: 30 }) as any,
    );
    vi.mocked(db.whitelist.findUnique).mockResolvedValueOnce(
      makeExistingWhitelist({ expireDate: now }) as any,
    );
    const before = Date.now();
    await fulfilCheckout(BASE_ARGS);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    const ms = (call.update.expireDate as Date).getTime();
    // Used "now", not the (already-expired) snapshot.
    expect(ms).toBeGreaterThanOrEqual(before + 30 * DAY_MS - 100);
  });

  it("links the renewed whitelist row to the new Order on update", async () => {
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(makePlan() as any);
    vi.mocked(db.whitelist.findUnique).mockResolvedValueOnce(
      makeExistingWhitelist({ expireDate: new Date(Date.now() + 5 * DAY_MS) }) as any,
    );
    vi.mocked(db.order.upsert).mockResolvedValueOnce({ id: "order-link-2" } as any);

    await fulfilCheckout(BASE_ARGS);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    expect(call.update.orderId).toBe("order-link-2");
  });
});

describe("fulfilCheckout — Whitelist · lifetime semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.order.upsert).mockResolvedValue({ id: "order-lt" } as any);
  });

  it("upgrades a duration-based whitelist to lifetime when buying a lifetime plan", async () => {
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(
      makePlan({ isLifetime: true, durationDays: null }) as any,
    );
    vi.mocked(db.whitelist.findUnique).mockResolvedValueOnce(
      makeExistingWhitelist({ expireDate: new Date(Date.now() + 10 * DAY_MS) }) as any,
    );
    await fulfilCheckout(BASE_ARGS);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    expect(call.update.isLifetime).toBe(true);
    expect(call.update.expireDate).toBeNull();
  });

  it("KEEPS lifetime when an already-lifetime user buys a duration plan (never downgrade)", async () => {
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(
      makePlan({ durationDays: 30 }) as any,
    );
    vi.mocked(db.whitelist.findUnique).mockResolvedValueOnce(
      makeExistingWhitelist({ isLifetime: true, expireDate: null }) as any,
    );
    await fulfilCheckout(BASE_ARGS);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    expect(call.update.isLifetime).toBe(true);
    expect(call.update.expireDate).toBeNull();
  });

  it("keeps lifetime even if duplicate lifetime purchases happen", async () => {
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(
      makePlan({ isLifetime: true, durationDays: null }) as any,
    );
    vi.mocked(db.whitelist.findUnique).mockResolvedValueOnce(
      makeExistingWhitelist({ isLifetime: true, expireDate: null }) as any,
    );
    await fulfilCheckout(BASE_ARGS);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    expect(call.update.isLifetime).toBe(true);
    expect(call.update.expireDate).toBeNull();
  });
});

describe("fulfilCheckout — Whitelist · duration edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.order.upsert).mockResolvedValue({ id: "order-edge" } as any);
    vi.mocked(db.whitelist.findUnique).mockResolvedValue(null);
  });

  it("treats a null durationDays on a non-lifetime plan as zero days (defensive)", async () => {
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(
      makePlan({ isLifetime: false, durationDays: null }) as any,
    );
    const before = Date.now();
    await fulfilCheckout(BASE_ARGS);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    const ms = (call.create.expireDate as Date).getTime();
    // 0 days extension = same as "now". (Not great UX, but better than NaN.)
    expect(ms).toBeGreaterThanOrEqual(before - 100);
    expect(ms).toBeLessThanOrEqual(Date.now() + 100);
  });

  it("handles a very long durationDays without overflowing Date math", async () => {
    vi.mocked(db.plan.findUnique).mockResolvedValueOnce(
      makePlan({ durationDays: 36500 }) as any, // 100 years
    );
    const before = Date.now();
    await fulfilCheckout(BASE_ARGS);
    const call = vi.mocked(db.whitelist.upsert).mock.calls[0]![0];
    const ms = (call.create.expireDate as Date).getTime();
    expect(ms).toBeGreaterThan(before + 36000 * DAY_MS);
  });
});

describe("fulfilCheckout — Idempotency", () => {
  it("calling twice with the same sessionId only depends on upsert semantics — never duplicates", async () => {
    vi.clearAllMocks();
    vi.mocked(db.plan.findUnique).mockResolvedValue(makePlan() as any);
    vi.mocked(db.whitelist.findUnique).mockResolvedValue(null);
    vi.mocked(db.order.upsert).mockResolvedValue({ id: "order-X" } as any);
    vi.mocked(db.whitelist.upsert).mockResolvedValue({ id: "wl-X" } as any);

    await fulfilCheckout(BASE_ARGS);
    await fulfilCheckout(BASE_ARGS);

    // Both calls used `upsert` (not `create`) with the same key.
    expect(db.order.upsert).toHaveBeenCalledTimes(2);
    const call1 = vi.mocked(db.order.upsert).mock.calls[0]![0];
    const call2 = vi.mocked(db.order.upsert).mock.calls[1]![0];
    expect(call1.where).toEqual(call2.where);
    expect(call1.where.stripeSessionId).toBe("cs_test_123");
  });
});
