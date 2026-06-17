/**
 * Tests for `cn` — the className merge helper used everywhere in the UI.
 * It composes `clsx` (conditional joins) and `tailwind-merge` (resolves
 * conflicts so `cn('p-2', 'p-4')` ends up as just `'p-4'`).
 *
 * We're not retesting the upstream libraries — just the integration:
 * does our wrapper preserve their semantics?
 */
import { describe, it, expect } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
  it("joins multiple class strings with a single space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("returns an empty string for no arguments", () => {
    expect(cn()).toBe("");
  });

  it("filters out falsy values", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("supports conditional clsx-style object form", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });

  it("supports nested arrays (clsx feature)", () => {
    expect(cn(["a", ["b", "c"]])).toBe("a b c");
  });

  it("merges conflicting Tailwind utilities — later wins", () => {
    // The tailwind-merge job: keep only the last p-* class.
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("merges conflicting colors with the same property — later wins", () => {
    expect(cn("text-pink-500", "text-cyan-500")).toBe("text-cyan-500");
  });

  it("keeps non-conflicting Tailwind utilities unchanged", () => {
    const out = cn("p-2", "text-pink-500", "rounded");
    // Order may shift; assert membership of all expected utilities.
    expect(out.split(" ").sort()).toEqual(["p-2", "rounded", "text-pink-500"]);
  });

  it("respects responsive variants as distinct dimensions", () => {
    // `p-2` and `md:p-4` aren't a conflict — different breakpoint.
    const out = cn("p-2", "md:p-4");
    expect(out).toContain("p-2");
    expect(out).toContain("md:p-4");
  });
});
