/**
 * Tests for `priceBreakdown` — the pricing math that decides
 * how much we charge a customer when they pick Card vs PromptPay.
 *
 * Why this matters: a tiny bug here = under/over-charging real money.
 * We assert exact totals (not "approximately equal") so silent
 * rounding regressions are caught.
 */
import { describe, it, expect } from "vitest";
import { priceBreakdown } from "../settings";

describe("priceBreakdown", () => {
  describe("PromptPay — no fee path", () => {
    it("returns the subtotal unchanged for promptpay even when a card fee is configured", () => {
      const r = priceBreakdown(100, "promptpay", 3);
      expect(r).toEqual({ subtotal: 100, feePercent: 0, fee: 0, total: 100 });
    });

    it("treats promptpay with zero fee the same way", () => {
      const r = priceBreakdown(199, "promptpay", 0);
      expect(r.total).toBe(199);
      expect(r.fee).toBe(0);
    });

    it("handles fractional subtotal cleanly", () => {
      const r = priceBreakdown(99.99, "promptpay", 5);
      expect(r.total).toBe(99.99);
      expect(r.fee).toBe(0);
    });

    it("handles a subtotal of zero", () => {
      const r = priceBreakdown(0, "promptpay", 3);
      expect(r).toEqual({ subtotal: 0, feePercent: 0, fee: 0, total: 0 });
    });
  });

  describe("Card — fee path", () => {
    it("adds a 3% fee on a round subtotal", () => {
      const r = priceBreakdown(100, "card", 3);
      expect(r).toEqual({ subtotal: 100, feePercent: 3, fee: 3, total: 103 });
    });

    it("rounds the fee to 2 decimals (e.g. 199 * 3% = 5.97)", () => {
      const r = priceBreakdown(199, "card", 3);
      expect(r.fee).toBe(5.97);
      expect(r.total).toBe(204.97);
    });

    it("rounds away tiny floating-point junk on the total", () => {
      // 0.1 + 0.2 = 0.30000000000000004 territory — the function should round.
      const r = priceBreakdown(0.1, "card", 100); // 100% fee → fee = 0.1
      expect(r.total).toBe(0.2);
    });

    it("supports a non-integer fee percent (e.g. 2.5%)", () => {
      const r = priceBreakdown(200, "card", 2.5);
      expect(r.fee).toBe(5);
      expect(r.total).toBe(205);
    });

    it("falls back to the no-fee path when card fee percent is zero", () => {
      // Same as PromptPay shape — zero fee means we don't surcharge cards.
      const r = priceBreakdown(150, "card", 0);
      expect(r).toEqual({ subtotal: 150, feePercent: 0, fee: 0, total: 150 });
    });

    it("falls back to the no-fee path when card fee percent is negative (defensive)", () => {
      // Settings clamps this to >=0, but defensive: if anyone passes a
      // negative we shouldn't accidentally discount the order.
      const r = priceBreakdown(150, "card", -5);
      expect(r.fee).toBe(0);
      expect(r.total).toBe(150);
    });

    it("does not lose precision on satang (THB sub-unit) totals", () => {
      // 49.50 * 1.03 = 50.985 → rounded total should be 50.99 (not 50.98).
      const r = priceBreakdown(49.5, "card", 3);
      expect(r.total).toBe(50.99);
    });
  });

  describe("Shape invariants", () => {
    it("always returns the four expected keys", () => {
      const r = priceBreakdown(100, "card", 3);
      expect(Object.keys(r).sort()).toEqual(["fee", "feePercent", "subtotal", "total"]);
    });

    it("subtotal is echoed back verbatim", () => {
      const r = priceBreakdown(123.45, "card", 3);
      expect(r.subtotal).toBe(123.45);
    });
  });
});
