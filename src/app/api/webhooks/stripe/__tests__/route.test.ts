/**
 * Tests for the `/api/webhooks/stripe` route handler.
 *
 * The handler MUST:
 *   1. Reject requests without the `stripe-signature` header (400).
 *   2. Reject requests whose signature doesn't verify (400).
 *   3. On a verified `checkout.session.completed` (paid) event →
 *      call `fulfilCheckout` exactly once with the right shape.
 *   4. On a `checkout.session.completed` event that's still unpaid
 *      (PromptPay pending) → NOT call fulfilCheckout (it'll come
 *      back via `async_payment_succeeded`).
 *   5. On `checkout.session.async_payment_succeeded` → call
 *      fulfilCheckout (the async settlement path).
 *   6. On unknown event types → 200 with no side-effect.
 *   7. Bubble fulfilment errors to a 500 so Stripe retries.
 *
 * The Stripe SDK is mocked so we never actually hit Stripe's servers,
 * and `fulfilCheckout` is mocked so we can assert the call args.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Env — only the webhook secret matters here.
vi.mock("@/lib/env", () => ({
  env: new Proxy({} as any, {
    get(_, key) {
      if (key === "STRIPE_WEBHOOK_SECRET") return "whsec_test";
      return "stub";
    },
  }),
}));

// Stripe — give us a constructEvent we can pre-program.
// `vi.hoisted` is required so the factory below (which is hoisted to
// the top of the file) can reference our mock fn.
const { constructEvent } = vi.hoisted(() => ({ constructEvent: vi.fn() }));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent },
  },
}));

// fulfilCheckout — the side-effect we want to assert.
vi.mock("@/lib/checkout", () => ({
  fulfilCheckout: vi.fn(),
}));

import { POST } from "../route";
import { fulfilCheckout } from "@/lib/checkout";

// ── Helpers ──────────────────────────────────────────────────

function makeReq(body: string, headers: Record<string, string> = {}) {
  const req = new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers,
  });
  return req as any;
}

function makePaidSessionEvent(overrides: Partial<{
  type: string;
  payment_status: "paid" | "unpaid";
  paymentMethods: string[];
  metadata: Record<string, string>;
  paymentIntent: string | { id: string } | null;
  customerDetails: { email: string | null } | null;
  customerEmail: string | null;
}> = {}) {
  return {
    type: overrides.type ?? "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_abc",
        payment_status: overrides.payment_status ?? "paid",
        payment_method_types: overrides.paymentMethods ?? ["card"],
        payment_intent: "paymentIntent" in overrides ? overrides.paymentIntent : "pi_test_xyz",
        metadata: overrides.metadata ?? {
          productId: "prod-1",
          planId: "plan-30d",
          username: "judy_player",
        },
        amount_total: 35000,
        currency: "thb",
        customer_details: "customerDetails" in overrides ? overrides.customerDetails : null,
        customer_email:   "customerEmail"   in overrides ? overrides.customerEmail   : null,
      },
    },
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("/api/webhooks/stripe — signature gate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when the stripe-signature header is missing", async () => {
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/stripe-signature/i);
    expect(constructEvent).not.toHaveBeenCalled();
    expect(fulfilCheckout).not.toHaveBeenCalled();
  });

  it("returns 400 when constructEvent throws (bad signature)", async () => {
    constructEvent.mockImplementationOnce(() => {
      throw new Error("invalid signature");
    });
    // The route logs the failure to console.error — expected, silence it
    // so the test output stays clean.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeReq("body", { "stripe-signature": "t=1,v1=deadbeef" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid signature");
    expect(fulfilCheckout).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("verifies using the raw body bytes (not a parsed JSON)", async () => {
    constructEvent.mockReturnValueOnce({ type: "ignored" });
    await POST(makeReq("raw-body-bytes", { "stripe-signature": "t=1,v1=x" }));
    expect(constructEvent).toHaveBeenCalledWith("raw-body-bytes", "t=1,v1=x", "whsec_test");
  });
});

describe("/api/webhooks/stripe — checkout.session.completed (paid)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls fulfilCheckout exactly once with the right shape", async () => {
    constructEvent.mockReturnValueOnce(makePaidSessionEvent());
    const res = await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(res.status).toBe(200);
    expect(fulfilCheckout).toHaveBeenCalledTimes(1);
    expect(fulfilCheckout).toHaveBeenCalledWith({
      stripeSessionId: "cs_test_abc",
      stripePaymentId: "pi_test_xyz",
      metadata: {
        productId: "prod-1", planId: "plan-30d", username: "judy_player",
      },
      amountTotal: 35000,
      currency: "thb",
      paymentMethod: "CARD",
      customerEmail: null,
    });
  });

  it("maps payment_method_types=['promptpay'] → PROMPTPAY", async () => {
    constructEvent.mockReturnValueOnce(makePaidSessionEvent({
      paymentMethods: ["promptpay"],
    }));
    await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(vi.mocked(fulfilCheckout).mock.calls[0]![0].paymentMethod).toBe("PROMPTPAY");
  });

  it("falls back to CARD when payment_method_types is missing", async () => {
    constructEvent.mockReturnValueOnce(makePaidSessionEvent({
      paymentMethods: [],
    }));
    await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(vi.mocked(fulfilCheckout).mock.calls[0]![0].paymentMethod).toBe("CARD");
  });

  it("accepts payment_intent as an object (expanded) and pulls .id", async () => {
    constructEvent.mockReturnValueOnce(makePaidSessionEvent({
      paymentIntent: { id: "pi_expanded" } as any,
    }));
    await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(vi.mocked(fulfilCheckout).mock.calls[0]![0].stripePaymentId).toBe("pi_expanded");
  });

  it("forwards customer_details.email so the Whitelist row gets a 'Stripe: …' label", async () => {
    constructEvent.mockReturnValueOnce(makePaidSessionEvent({
      customerDetails: { email: "buyer@example.com" },
    }));
    await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(vi.mocked(fulfilCheckout).mock.calls[0]![0].customerEmail).toBe("buyer@example.com");
  });

  it("falls back to customer_email when customer_details is absent", async () => {
    constructEvent.mockReturnValueOnce(makePaidSessionEvent({
      customerDetails: null,
      customerEmail: "prefilled@example.com",
    }));
    await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(vi.mocked(fulfilCheckout).mock.calls[0]![0].customerEmail).toBe("prefilled@example.com");
  });

  it("passes customerEmail=null when Stripe sends neither field", async () => {
    constructEvent.mockReturnValueOnce(makePaidSessionEvent());
    await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(vi.mocked(fulfilCheckout).mock.calls[0]![0].customerEmail).toBeNull();
  });

  it("handles payment_intent=null (PromptPay before settlement)", async () => {
    constructEvent.mockReturnValueOnce(makePaidSessionEvent({
      paymentIntent: null,
    }));
    await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(vi.mocked(fulfilCheckout).mock.calls[0]![0].stripePaymentId).toBeNull();
  });

  it("SKIPS fulfilment when payment_status is still 'unpaid' (async PromptPay)", async () => {
    constructEvent.mockReturnValueOnce(makePaidSessionEvent({
      payment_status: "unpaid",
    }));
    const res = await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(res.status).toBe(200);
    expect(fulfilCheckout).not.toHaveBeenCalled();
  });
});

describe("/api/webhooks/stripe — async settlement path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls fulfilCheckout on checkout.session.async_payment_succeeded", async () => {
    constructEvent.mockReturnValueOnce(makePaidSessionEvent({
      type: "checkout.session.async_payment_succeeded",
      payment_status: "paid",
    }));
    const res = await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(res.status).toBe(200);
    expect(fulfilCheckout).toHaveBeenCalledTimes(1);
  });

  it("does NOT fulfil on checkout.session.async_payment_failed (current code is a no-op)", async () => {
    constructEvent.mockReturnValueOnce(makePaidSessionEvent({
      type: "checkout.session.async_payment_failed",
    }));
    const res = await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(res.status).toBe(200);
    expect(fulfilCheckout).not.toHaveBeenCalled();
  });
});

describe("/api/webhooks/stripe — unknown event type", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 and ignores the event", async () => {
    constructEvent.mockReturnValueOnce({
      type: "customer.subscription.created",
      data: { object: {} },
    });
    const res = await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(res.status).toBe(200);
    expect(fulfilCheckout).not.toHaveBeenCalled();
  });
});

describe("/api/webhooks/stripe — handler error", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 500 when fulfilCheckout throws — Stripe retries via the open 5xx", async () => {
    constructEvent.mockReturnValueOnce(makePaidSessionEvent());
    vi.mocked(fulfilCheckout).mockRejectedValueOnce(new Error("DB down"));
    // Suppress the console.error this path logs.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Handler error");
    errSpy.mockRestore();
  });
});

describe("/api/webhooks/stripe — happy-path response", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns { received: true } on a fulfilled event", async () => {
    constructEvent.mockReturnValueOnce(makePaidSessionEvent());
    const res = await POST(makeReq("body", { "stripe-signature": "x" }));
    expect(await res.json()).toEqual({ received: true });
  });
});
