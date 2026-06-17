/**
 * Tests for `sanitizeRichText` + `stripRichText`.
 *
 * The contract: hostile input must end up safe; admin output (bold,
 * lists, headings, links) must survive untouched.
 */
import { describe, it, expect } from "vitest";
import { sanitizeRichText, stripRichText } from "../sanitize";

describe("sanitizeRichText — keeps the good stuff", () => {
  it("preserves <p>, <strong>, <em>, <u>, <s>", () => {
    const html = "<p>Hello <strong>world</strong> <em>italic</em> <u>under</u> <s>strike</s></p>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("preserves <h2> and <h3>", () => {
    expect(sanitizeRichText("<h2>Big</h2><h3>Smaller</h3>")).toBe("<h2>Big</h2><h3>Smaller</h3>");
  });

  it("preserves bulleted + ordered lists", () => {
    const html = "<ul><li>a</li><li>b</li></ul><ol><li>1</li></ol>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("preserves <blockquote> + <hr>", () => {
    expect(sanitizeRichText("<blockquote>Quote</blockquote><hr>")).toContain("<blockquote>");
  });

  it("preserves <a> with a safe http href", () => {
    const out = sanitizeRichText('<a href="https://example.com">link</a>');
    expect(out).toContain('href="https://example.com"');
  });
});

describe("sanitizeRichText — strips the bad stuff", () => {
  it("strips <script> tags", () => {
    const out = sanitizeRichText('<p>safe</p><script>alert(1)</script>');
    expect(out).toBe("<p>safe</p>");
    expect(out).not.toContain("script");
  });

  it("strips inline event handlers", () => {
    const out = sanitizeRichText('<p onclick="alert(1)">x</p>');
    expect(out).not.toContain("onclick");
    expect(out).toContain("<p>x</p>");
  });

  it("strips inline style attribute (admins cannot set colors)", () => {
    const out = sanitizeRichText('<p style="color: red">colored</p>');
    expect(out).not.toContain("style=");
    expect(out).not.toContain("color: red");
    expect(out).toBe("<p>colored</p>");
  });

  it("strips class attribute", () => {
    const out = sanitizeRichText('<p class="evil">x</p>');
    expect(out).not.toContain("class");
  });

  it("strips id attribute", () => {
    const out = sanitizeRichText('<p id="evil">x</p>');
    expect(out).not.toContain("id=");
  });

  it("strips <iframe> entirely", () => {
    expect(sanitizeRichText('<iframe src="evil.com"></iframe>')).toBe("");
  });

  it("strips <img> entirely (images go through the gallery upload, not TipTap)", () => {
    expect(sanitizeRichText('<img src="https://evil.com/track.gif">')).not.toContain("img");
  });

  it("strips data-* attributes", () => {
    const out = sanitizeRichText('<p data-evil="1">x</p>');
    expect(out).not.toContain("data-evil");
  });
});

describe("sanitizeRichText — anchor href safety", () => {
  it("strips javascript: URIs", () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain("javascript:");
    // The href is removed; the anchor itself stays but with no href.
    expect(out).toContain("click");
  });

  it("strips data: URIs", () => {
    const out = sanitizeRichText('<a href="data:text/html,<script>">x</a>');
    expect(out).not.toContain("data:");
  });

  it("preserves mailto: links", () => {
    const out = sanitizeRichText('<a href="mailto:hi@example.com">mail</a>');
    expect(out).toContain('href="mailto:hi@example.com"');
  });

  it("forces target=_blank rel=noopener on every <a>", () => {
    const out = sanitizeRichText('<a href="https://x.com">click</a>');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("overrides any rel admin tries to set", () => {
    // Even if admin somehow injected rel="opener" we replace it.
    const out = sanitizeRichText('<a href="https://x.com" rel="opener">x</a>');
    expect(out).toContain('rel="noopener noreferrer"');
  });
});

describe("sanitizeRichText — edge cases", () => {
  it("returns empty string for null / undefined / empty input", () => {
    expect(sanitizeRichText(null)).toBe("");
    expect(sanitizeRichText(undefined)).toBe("");
    expect(sanitizeRichText("")).toBe("");
  });

  it("trims leading/trailing whitespace from final output", () => {
    expect(sanitizeRichText("   <p>x</p>   ")).toBe("<p>x</p>");
  });

  it("collapses an entirely-hostile document to empty string", () => {
    expect(sanitizeRichText('<script>alert(1)</script>')).toBe("");
  });

  it("does not crash on malformed HTML", () => {
    expect(() => sanitizeRichText('<p><strong>unclosed')).not.toThrow();
  });
});

describe("stripRichText", () => {
  it("returns plain text only", () => {
    expect(stripRichText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("collapses whitespace runs", () => {
    expect(stripRichText("<p>a   b\n\nc</p>")).toBe("a b c");
  });

  it("returns empty string for null / empty", () => {
    expect(stripRichText(null)).toBe("");
    expect(stripRichText("")).toBe("");
  });

  it("strips even scripts (defence-in-depth)", () => {
    expect(stripRichText("<script>alert(1)</script><p>safe</p>")).toBe("safe");
  });
});
