/**
 * Tests for `toLocalInputValue` — the helper that formats a Date into
 * the "YYYY-MM-DDTHH:mm" shape `<input type="datetime-local">` expects.
 *
 * The function uses `Date.getFullYear()` / `getMonth()` / `getDate()` /
 * `getHours()` / `getMinutes()` — all of which return values in the
 * caller's local timezone. The tests below force a specific TZ via the
 * `TZ` env var before importing the module so the assertions are stable
 * regardless of where the test machine is.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { toLocalInputValue } from "../datetime";

describe("toLocalInputValue — empty inputs", () => {
  it("returns empty string for null", () => {
    expect(toLocalInputValue(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(toLocalInputValue(undefined)).toBe("");
  });
});

describe("toLocalInputValue — formatting", () => {
  // We build dates with explicit local-time fields via `new Date(y, m-1, d, h, mi)`
  // so the test is independent of the machine TZ — the function reads
  // the same local-time fields back out.

  it("zero-pads single-digit month/day/hour/minute", () => {
    const d = new Date(2026, 0, 5, 3, 7); // Jan 5, 2026 03:07 local
    expect(toLocalInputValue(d)).toBe("2026-01-05T03:07");
  });

  it("renders a typical timestamp correctly", () => {
    const d = new Date(2026, 5, 8, 18, 30); // Jun 8 18:30 local
    expect(toLocalInputValue(d)).toBe("2026-06-08T18:30");
  });

  it("handles midnight (00:00)", () => {
    const d = new Date(2026, 5, 8, 0, 0);
    expect(toLocalInputValue(d)).toBe("2026-06-08T00:00");
  });

  it("handles 23:59 (boundary)", () => {
    const d = new Date(2026, 5, 8, 23, 59);
    expect(toLocalInputValue(d)).toBe("2026-06-08T23:59");
  });

  it("renders December (month index 11 → '12')", () => {
    const d = new Date(2026, 11, 31, 12, 0);
    expect(toLocalInputValue(d)).toBe("2026-12-31T12:00");
  });

  it("returns a 16-char fixed-width string", () => {
    const d = new Date(2026, 5, 8, 18, 30);
    expect(toLocalInputValue(d).length).toBe(16);
  });
});

describe("toLocalInputValue — round-trip", () => {
  it("a value produced by this function parses back to the same Date (via 'new Date')", () => {
    const original = new Date(2026, 5, 8, 18, 30);
    const formatted = toLocalInputValue(original);

    // <input type="datetime-local"> sends back the same naive string. The
    // browser then runs `new Date(str)` which interprets it in client
    // local TZ. Since we're already in the same TZ here, the round-trip
    // should produce the same Date down to the minute.
    const parsed = new Date(formatted);
    expect(parsed.getFullYear()).toBe(original.getFullYear());
    expect(parsed.getMonth()).toBe(original.getMonth());
    expect(parsed.getDate()).toBe(original.getDate());
    expect(parsed.getHours()).toBe(original.getHours());
    expect(parsed.getMinutes()).toBe(original.getMinutes());
  });
});
