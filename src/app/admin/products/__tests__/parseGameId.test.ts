/**
 * Tests for `parseGameId`.
 *
 * The admin Product form accepts either a full Roblox URL or bare
 * digits — this helper unifies them down to just the place-id digits
 * that we store in `Product.gameId`. The function must:
 *
 *   - Accept URLs of any case, with or without protocol.
 *   - Accept bare digits, optionally with thousands separators.
 *   - Return `null` for anything genuinely empty.
 *   - Never throw (admins paste all sorts of garbage in).
 */
import { describe, it, expect } from "vitest";
import { parseGameId } from "../_helpers";

describe("parseGameId — Roblox URLs", () => {
  it("extracts the place id from a canonical roblox.com/games URL", () => {
    expect(parseGameId("https://www.roblox.com/games/12345678/My-Game")).toBe("12345678");
  });

  it("handles a URL without the trailing slug", () => {
    expect(parseGameId("https://www.roblox.com/games/12345678")).toBe("12345678");
  });

  it("handles a URL without protocol", () => {
    expect(parseGameId("www.roblox.com/games/987654/Some-Game")).toBe("987654");
  });

  it("handles the short roblox.com domain (no www)", () => {
    expect(parseGameId("https://roblox.com/games/55555/Foo")).toBe("55555");
  });

  it("handles uppercase /GAMES/ (case-insensitive match)", () => {
    expect(parseGameId("https://www.roblox.com/GAMES/77777/Foo")).toBe("77777");
  });

  it("handles a URL with query string", () => {
    expect(parseGameId("https://www.roblox.com/games/12345?ref=share")).toBe("12345");
  });

  it("trims leading / trailing whitespace before parsing", () => {
    expect(parseGameId("   https://www.roblox.com/games/99/Foo   ")).toBe("99");
  });

  it("ignores any digits before /games/ — only the place id wins", () => {
    expect(parseGameId("https://www.roblox.com/users/4242/profile?game=/games/8888/foo"))
      .toBe("8888");
  });
});

describe("parseGameId — bare digit input", () => {
  it("returns plain digits unchanged", () => {
    expect(parseGameId("12345678")).toBe("12345678");
  });

  it("strips internal spaces", () => {
    expect(parseGameId("123 456 78")).toBe("12345678");
  });

  it("strips thousands-separator commas", () => {
    expect(parseGameId("12,345,678")).toBe("12345678");
  });

  it("strips arbitrary non-digit punctuation", () => {
    expect(parseGameId("ID: 12345678!")).toBe("12345678");
  });

  it("preserves leading zeros if the admin entered them (rare but safe)", () => {
    expect(parseGameId("00012345")).toBe("00012345");
  });
});

describe("parseGameId — empty / unusable", () => {
  it("returns null for null", () => {
    expect(parseGameId(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseGameId(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseGameId("")).toBeNull();
  });

  it("returns null for whitespace-only", () => {
    expect(parseGameId("   ")).toBeNull();
  });

  it("returns null for a string with no digits at all", () => {
    expect(parseGameId("abc-def")).toBeNull();
  });

  it("returns null when /games/ has no digits after it", () => {
    // Falls through to digits-only path; "/games/" contains no digits.
    expect(parseGameId("https://www.roblox.com/games/")).toBeNull();
  });
});
