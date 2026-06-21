/**
 * Tests for `formatTHB` / `formatUSD`.
 *
 * These wrap `Intl.NumberFormat`. We exercise:
 *   - Zero, integer, large integer
 *   - Negative
 *   - Rounding to zero fraction digits
 *   - Currency symbol presence
 *
 * Note: Intl output varies slightly across Node versions (e.g. NBSP vs
 * regular space between symbol and digits). The assertions use
 * `String.includes` / digit-only regex extraction rather than exact
 * equality where Intl behaviour is platform-dependent.
 */
import { describe, it, expect } from "vitest";
import { formatTHB, formatUSD } from "../format";

function digits(s: string): string {
  return s.replace(/[^\d-]/g, "");
}

describe("formatTHB", () => {
  it("includes a Thai baht symbol or 'THB'", () => {
    const out = formatTHB(100);
    // Either '฿' or 'THB' depending on ICU build.
    expect(/฿|THB/.test(out)).toBe(true);
  });

  it("rounds to zero fraction digits", () => {
    expect(digits(formatTHB(1234.56))).toContain("1235");
  });

  it("renders 0 as a zero amount", () => {
    expect(digits(formatTHB(0))).toBe("0");
  });

  it("groups thousands", () => {
    const out = formatTHB(1_234_567);
    // Some locales use ',' separators — should at least contain the digits.
    expect(digits(out)).toBe("1234567");
    expect(out.length).toBeGreaterThan(7); // separators / symbol added
  });

  it("includes a minus sign for negative amounts", () => {
    expect(formatTHB(-50)).toMatch(/-/);
  });
});

describe("formatUSD", () => {
  it("includes a $ or USD label", () => {
    const out = formatUSD(100);
    expect(/\$|USD/.test(out)).toBe(true);
  });

  it("always shows two decimal places (so $19 + 10% fee shows $20.90, not $21)", () => {
    expect(digits(formatUSD(9.99))).toBe("999");
    expect(digits(formatUSD(20.9))).toBe("2090");
  });

  it("renders 0 with cents", () => {
    expect(digits(formatUSD(0))).toBe("000");
  });

  it("groups thousands in US style", () => {
    expect(formatUSD(1234)).toMatch(/1,234|1.234/); // most builds use ','
  });
});

describe("paymentMethodLabel", () => {
  it("maps each enum value to a display label", async () => {
    const { paymentMethodLabel } = await import("../format");
    expect(paymentMethodLabel("CARD")).toBe("Card");
    expect(paymentMethodLabel("PAYPAL")).toBe("PayPal");
    expect(paymentMethodLabel("PROMPTPAY")).toBe("PromptPay");
  });

  it("defaults unknown values to PromptPay (defensive)", async () => {
    const { paymentMethodLabel } = await import("../format");
    expect(paymentMethodLabel("UNKNOWN")).toBe("PromptPay");
  });
});
