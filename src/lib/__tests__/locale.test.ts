/**
 * Tests for `pickI18n` — the EN/TH picker that powers every page label.
 *
 * Behavioural rules:
 *   1. Prefer the requested locale.
 *   2. If that side is missing / blank, fall back to the other side.
 *   3. Whitespace-only values count as "missing".
 *   4. Default locale is "th".
 *   5. Returns "" (never null/undefined) when both sides are empty.
 */
import { describe, it, expect } from "vitest";
import { pickI18n, DEFAULT_LOCALE, LOCALES } from "../locale";

describe("pickI18n", () => {
  describe("Happy path — both languages present", () => {
    it("returns Thai when locale is 'th'", () => {
      expect(pickI18n("Hello", "สวัสดี", "th")).toBe("สวัสดี");
    });

    it("returns English when locale is 'en'", () => {
      expect(pickI18n("Hello", "สวัสดี", "en")).toBe("Hello");
    });

    it("defaults to English when locale is omitted", () => {
      expect(pickI18n("Hello", "สวัสดี")).toBe("Hello");
    });
  });

  describe("Fallback — preferred side missing", () => {
    it("falls back to EN when TH is empty string", () => {
      expect(pickI18n("Hello", "", "th")).toBe("Hello");
    });

    it("falls back to EN when TH is null", () => {
      expect(pickI18n("Hello", null, "th")).toBe("Hello");
    });

    it("falls back to EN when TH is undefined", () => {
      expect(pickI18n("Hello", undefined, "th")).toBe("Hello");
    });

    it("falls back to EN when TH is whitespace-only", () => {
      expect(pickI18n("Hello", "   ", "th")).toBe("Hello");
    });

    it("falls back to TH when EN is empty (locale=en)", () => {
      expect(pickI18n("", "สวัสดี", "en")).toBe("สวัสดี");
    });

    it("falls back to TH when EN is null (locale=en)", () => {
      expect(pickI18n(null, "สวัสดี", "en")).toBe("สวัสดี");
    });
  });

  describe("Edge cases — both sides empty / blank", () => {
    it("returns '' when both are null", () => {
      expect(pickI18n(null, null)).toBe("");
    });

    it("returns '' when both are undefined", () => {
      expect(pickI18n(undefined, undefined)).toBe("");
    });

    it("returns '' when both are empty strings", () => {
      expect(pickI18n("", "")).toBe("");
    });

    it("returns '' when both are whitespace-only", () => {
      expect(pickI18n("   ", "\t\n  ", "en")).toBe("");
    });
  });

  describe("Trimming", () => {
    it("trims the returned value", () => {
      expect(pickI18n("  Hello  ", "  สวัสดี  ", "en")).toBe("Hello");
      expect(pickI18n("  Hello  ", "  สวัสดี  ", "th")).toBe("สวัสดี");
    });

    it("does not return purely whitespace as 'present'", () => {
      // The TH side has whitespace only — should NOT be picked; falls
      // back to the non-blank EN side.
      expect(pickI18n("Hello", "   ", "th")).toBe("Hello");
    });
  });
});

describe("Locale constants", () => {
  it("DEFAULT_LOCALE is 'en'", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("LOCALES includes both supported locales", () => {
    expect(LOCALES).toEqual(["en", "th"]);
  });
});
