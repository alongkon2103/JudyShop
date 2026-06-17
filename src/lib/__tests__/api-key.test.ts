/**
 * Tests for `safeEqual` — the constant-time string comparison used to
 * verify the x-api-key header on /api/checkwhitelist.
 *
 * Why constant-time? An equality check that bails on the first differing
 * byte leaks the prefix length through response timing. A constant-time
 * compare always reads both buffers in full so the response time is
 * independent of where the strings diverge.
 *
 * We can't reliably assert "constant-time" from the outside (it depends
 * on the CPU), but we can:
 *   - Pin the obvious truth-table cases.
 *   - Verify it doesn't crash on weird inputs (empty, unicode).
 */
import { describe, it, expect } from "vitest";
import { safeEqual } from "../api-key";

describe("safeEqual", () => {
  it("returns true for identical strings", () => {
    expect(safeEqual("hello", "hello")).toBe(true);
  });

  it("returns false for different strings of equal length", () => {
    expect(safeEqual("hello", "world")).toBe(false);
  });

  it("returns false for strings of different lengths (the length escape hatch)", () => {
    expect(safeEqual("a", "ab")).toBe(false);
    expect(safeEqual("abcd", "abc")).toBe(false);
  });

  it("returns false if exactly one side is empty", () => {
    expect(safeEqual("", "x")).toBe(false);
    expect(safeEqual("x", "")).toBe(false);
  });

  it("returns true when both sides are empty (boundary)", () => {
    expect(safeEqual("", "")).toBe(true);
  });

  it("is case-sensitive", () => {
    expect(safeEqual("Secret", "secret")).toBe(false);
  });

  it("handles unicode (UTF-8 multibyte) correctly via Buffer.from", () => {
    expect(safeEqual("สวัสดี", "สวัสดี")).toBe(true);
    expect(safeEqual("สวัสดี", "สวัสดี!")).toBe(false);
  });

  it("handles strings with a NUL byte", () => {
    expect(safeEqual("a\0b", "a\0b")).toBe(true);
    expect(safeEqual("a\0b", "a\0c")).toBe(false);
  });

  it("handles a realistic 64-char API key", () => {
    const a = "k_" + "a".repeat(62);
    const b = "k_" + "a".repeat(62);
    expect(safeEqual(a, b)).toBe(true);
    // Flip the very last char — would be caught only by a non-early-exit compare.
    const c = "k_" + "a".repeat(61) + "b";
    expect(safeEqual(a, c)).toBe(false);
  });
});
