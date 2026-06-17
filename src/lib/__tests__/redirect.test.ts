/**
 * Tests for `safeNextPath` — the open-redirect guard used on the admin
 * login `?next=` parameter. The goal is to make it impossible to phish
 * users via a crafted JudyShop URL that bounces to an attacker domain.
 *
 * The function returns the supplied `fallback` (default `/admin`)
 * whenever the candidate is anything other than a clean internal path
 * starting with a single "/".
 */
import { describe, it, expect } from "vitest";
import { safeNextPath } from "../redirect";

describe("safeNextPath — accepted (internal absolute paths)", () => {
  it("accepts a simple admin path", () => {
    expect(safeNextPath("/admin")).toBe("/admin");
  });

  it("accepts a nested admin path", () => {
    expect(safeNextPath("/admin/products/123")).toBe("/admin/products/123");
  });

  it("preserves query strings", () => {
    expect(safeNextPath("/admin?q=1&page=2")).toBe("/admin?q=1&page=2");
  });

  it("preserves hash fragments", () => {
    expect(safeNextPath("/admin#section")).toBe("/admin#section");
  });

  it("trims surrounding whitespace before validating", () => {
    expect(safeNextPath("  /admin  ")).toBe("/admin");
  });

  it("accepts a path right at the 512-char cap", () => {
    const path = "/" + "a".repeat(511);
    expect(path.length).toBe(512);
    expect(safeNextPath(path)).toBe(path);
  });
});

describe("safeNextPath — rejected (attack vectors)", () => {
  it("rejects null", () => {
    expect(safeNextPath(null)).toBe("/admin");
  });

  it("rejects undefined", () => {
    expect(safeNextPath(undefined)).toBe("/admin");
  });

  it("rejects empty string", () => {
    expect(safeNextPath("")).toBe("/admin");
  });

  it("rejects whitespace-only", () => {
    expect(safeNextPath("   ")).toBe("/admin");
  });

  it("rejects an absolute https URL", () => {
    expect(safeNextPath("https://evil.com/steal")).toBe("/admin");
  });

  it("rejects an absolute http URL", () => {
    expect(safeNextPath("http://evil.com")).toBe("/admin");
  });

  it("rejects a `javascript:` URI", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/admin");
  });

  it("rejects a `data:` URI", () => {
    expect(safeNextPath("data:text/html,<script>")).toBe("/admin");
  });

  it("rejects a protocol-relative URL (//evil.com)", () => {
    expect(safeNextPath("//evil.com/path")).toBe("/admin");
  });

  it("rejects a backslash form that some browsers normalise to //", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/admin");
    expect(safeNextPath("\\\\evil.com")).toBe("/admin");
  });

  it("rejects relative paths (no leading /)", () => {
    expect(safeNextPath("admin")).toBe("/admin");
    expect(safeNextPath("admin/products")).toBe("/admin");
  });

  it("rejects paths over the 512-char cap", () => {
    const tooLong = "/" + "a".repeat(512); // 513 total
    expect(tooLong.length).toBeGreaterThan(512);
    expect(safeNextPath(tooLong)).toBe("/admin");
  });

  it("rejects a non-string (defensive)", () => {
    // @ts-expect-error — testing runtime defence
    expect(safeNextPath(123)).toBe("/admin");
    // @ts-expect-error
    expect(safeNextPath({})).toBe("/admin");
  });
});

describe("safeNextPath — custom fallback", () => {
  it("uses the supplied fallback on rejection", () => {
    expect(safeNextPath("https://evil.com", "/")).toBe("/");
  });

  it("uses the supplied fallback for empty input", () => {
    expect(safeNextPath(null, "/login")).toBe("/login");
  });

  it("ignores the fallback when the candidate is valid", () => {
    expect(safeNextPath("/admin/x", "/somewhere-else")).toBe("/admin/x");
  });
});
