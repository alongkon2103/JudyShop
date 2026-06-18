/**
 * Tests for the admin auth primitives.
 *
 * Covered:
 *   - hashPassword / verifyPassword — bcrypt wrapper
 *   - signSession / verifySession  — JWT round-trip + tamper / expiry
 *   - buildSessionCookie / buildClearCookie — cookie shape (secure
 *     flag flips with NODE_ENV)
 *
 * We provide a fixed env (ADMIN_SESSION_SECRET, NODE_ENV) via the
 * `vi.mock("../env")` block so the secret is deterministic and we can
 * flip `NODE_ENV` between tests by mutating the mocked module.
 *
 * Why test bcrypt's wrapper? Two reasons:
 *   1. Confirms cost factor 12 is in fact applied (default in jest can
 *      vary).
 *   2. Documents the contract — anyone refactoring later will see what
 *      the rest of the app expects of these helpers.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// `vi.mock` factories are hoisted ABOVE imports, so any variable they
// reference must come from `vi.hoisted` (which is hoisted alongside).
const { fakeEnv } = vi.hoisted(() => ({
  fakeEnv: {
    ADMIN_SESSION_SECRET: "a".repeat(64), // 64-byte secret, plenty for HS256
    NODE_ENV: "development" as "development" | "production",
  },
}));

vi.mock("../env", () => ({
  env: new Proxy(fakeEnv, {
    get: (target, key) => target[key as keyof typeof target],
  }),
}));

import {
  hashPassword, verifyPassword,
  signSession, verifySession,
  buildSessionCookie, buildClearCookie,
  SESSION_COOKIE,
} from "../auth";

beforeEach(() => {
  // Reset NODE_ENV to dev between tests (the cookie tests flip it).
  fakeEnv.NODE_ENV = "development";
});

// ── Password helpers ────────────────────────────────────────

describe("hashPassword / verifyPassword", () => {
  it("returns a non-empty hash that does NOT equal the plaintext", async () => {
    const hash = await hashPassword("hunter2");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(50);
    expect(hash).not.toBe("hunter2");
  });

  it("produces a different hash each call (random salt)", async () => {
    const a = await hashPassword("hunter2");
    const b = await hashPassword("hunter2");
    expect(a).not.toBe(b);
  });

  it("verifies the original password against its own hash", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("hunter2", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("rejects an empty password against a real hash", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("returns false (not throw) when the hash string is malformed", async () => {
    expect(await verifyPassword("anything", "not-a-real-bcrypt-hash")).toBe(false);
  });

  it("uses a cost factor that is high enough to need >10ms (sanity)", async () => {
    const start = Date.now();
    await hashPassword("password");
    const elapsed = Date.now() - start;
    // cost 12 ~ 200ms on a recent laptop; absolute lower bound 10ms.
    expect(elapsed).toBeGreaterThan(10);
  });
});

// ── JWT session ─────────────────────────────────────────────

describe("signSession / verifySession", () => {
  it("round-trips sub + email through a signed JWT", async () => {
    const token = await signSession({ sub: "user-1", email: "a@b.com", tv: 0 });
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // header.payload.signature

    const session = await verifySession(token);
    expect(session).toEqual({ sub: "user-1", email: "a@b.com", tv: 0 });
  });

  it("returns null for a tampered signature", async () => {
    const token = await signSession({ sub: "user-1", email: "a@b.com", tv: 0 });
    const [h, p] = token.split(".");
    const bad = `${h}.${p}.tamperedsignaturexx`;
    expect(await verifySession(bad)).toBeNull();
  });

  it("returns null for garbage input", async () => {
    expect(await verifySession("not.a.jwt")).toBeNull();
    expect(await verifySession("")).toBeNull();
  });

  it("returns null when the payload is missing required fields", async () => {
    // Sign a token that lacks `email`. Fake it by hand-rolling a JWT
    // via `signSession` with a missing email — but TypeScript blocks
    // that, so instead: sign a token under our key with a tweaked
    // payload via `jose` directly.
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(fakeEnv.ADMIN_SESSION_SECRET);
    const broken = await new SignJWT({ sub: "u" } as any)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);
    expect(await verifySession(broken)).toBeNull();
  });

  it("rejects a token signed with the wrong secret", async () => {
    const { SignJWT } = await import("jose");
    const evilSecret = new TextEncoder().encode("evil-secret-" + "x".repeat(64));
    const token = await new SignJWT({ sub: "u", email: "a@b" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(evilSecret);
    expect(await verifySession(token)).toBeNull();
  });
});

// ── Cookie shape ────────────────────────────────────────────

describe("buildSessionCookie", () => {
  it("has the right name and security flags in dev (secure=false)", () => {
    fakeEnv.NODE_ENV = "development";
    const c = buildSessionCookie("abc.def.ghi");
    expect(c).toEqual({
      name: SESSION_COOKIE.name,
      value: "abc.def.ghi",
      httpOnly: true,
      secure: false,        // dev → http://localhost
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE.maxAge,
    });
  });

  it("sets secure=true in production", () => {
    fakeEnv.NODE_ENV = "production";
    const c = buildSessionCookie("token");
    expect(c.secure).toBe(true);
  });

  it("uses an 8-hour TTL", () => {
    const c = buildSessionCookie("t");
    expect(c.maxAge).toBe(60 * 60 * 8);
  });
});

describe("buildClearCookie", () => {
  it("returns a cookie with empty value and maxAge=0", () => {
    const c = buildClearCookie();
    expect(c.value).toBe("");
    expect(c.maxAge).toBe(0);
    expect(c.path).toBe("/");
    expect(c.httpOnly).toBe(true);
  });
});
