/**
 * Safety-rail tests for admin management actions.
 *
 * The functional behaviour (creating, updating, hashing) is straightforward
 * — what's load-bearing is the set of guards that prevent an admin from
 * accidentally locking the entire team out:
 *
 *   1. createAdmin    — duplicate email rejected with a friendly message
 *   2. updateAdmin    — self cannot deactivate self
 *   3. updateAdmin    — last active admin cannot be deactivated
 *   4. resetPassword  — always bumps tokenVersion (kicks all sessions)
 *   5. forceLogout    — cannot target self (use normal logout button)
 *
 * The DB, audit log, requireAdmin guard, and hashPassword are mocked at
 * the module boundary so these tests never hit a real database.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("../../../../lib/env", () => ({
  env: new Proxy({}, { get: () => "test-env-stub" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("../../../../lib/audit", () => ({
  logAdmin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../lib/auth", () => ({
  hashPassword: vi.fn(async (pw: string) => `hashed:${pw}`),
}));

// Default session = admin id "self-1". Individual tests can rebind.
const sessionMock = vi.fn(async () => ({
  sub: "self-1",
  email: "self@admin.com",
  tv: 0,
  role: "ADMIN" as "ADMIN" | "PARTNER",
  partnerId: null as string | null,
}));
vi.mock("../../../../lib/admin-session", () => ({
  requireAdmin: () => sessionMock(),
}));

vi.mock("../../../../lib/db", () => {
  const db = {
    adminUser: {
      create:     vi.fn(),
      update:     vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      count:      vi.fn(),
    },
    partner: {
      findUnique: vi.fn(),
    },
  };
  return { db };
});

// Import AFTER mocks are set so the module picks them up.
import {
  createAdmin,
  updateAdmin,
  resetAdminPassword,
  forceLogoutAdmin,
  forceLogoutAllAdmins,
} from "../_actions";
import { db } from "../../../../lib/db";

const mockDb = db as unknown as {
  adminUser: {
    create:     ReturnType<typeof vi.fn>;
    update:     ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count:      ReturnType<typeof vi.fn>;
  };
  partner: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.mockResolvedValue({ sub: "self-1", email: "self@admin.com", tv: 0, role: "ADMIN", partnerId: null });
});

describe("createAdmin", () => {
  it("rejects an invalid email with a friendly message", async () => {
    const res = await createAdmin(fd({ email: "not-an-email", password: "longenoughpw1" }));
    expect(res).toEqual({ ok: false, error: "Email ไม่ถูกต้อง" });
    expect(mockDb.adminUser.create).not.toHaveBeenCalled();
  });

  it("rejects a too-short password with a length message", async () => {
    const res = await createAdmin(fd({ email: "ok@admin.com", password: "short" }));
    expect(res).toEqual({ ok: false, error: "Password ต้องยาวอย่างน้อย 12 ตัว" });
    expect(mockDb.adminUser.create).not.toHaveBeenCalled();
  });

  it("translates a duplicate-email DB error into a user-readable message", async () => {
    mockDb.adminUser.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const res = await createAdmin(fd({ email: "dup@admin.com", password: "longenoughpw1" }));
    expect(res).toEqual({ ok: false, error: "Email นี้มีอยู่แล้ว" });
  });

  it("creates the admin on a happy path", async () => {
    mockDb.adminUser.create.mockResolvedValueOnce({ id: "new-1" });
    const res = await createAdmin(
      fd({ email: "  NEW@admin.COM  ", name: " New ", password: "longenoughpw1" }),
    );
    expect(res).toEqual({ ok: true });
    expect(mockDb.adminUser.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email:        "new@admin.com",   // lowercased + trimmed
        name:         "New",
        passwordHash: "hashed:longenoughpw1",
        isActive:     true,
        tokenVersion: 0,
        role:         "ADMIN",
        partnerId:    null,
      }),
    });
  });

  it("rejects a PARTNER role with no partner selected", async () => {
    const res = await createAdmin(
      fd({ email: "p@x.com", password: "longenoughpw1", role: "PARTNER" }),
    );
    expect(res).toEqual({ ok: false, error: "เลือก Partner ให้ผู้ใช้ที่เป็น Partner ก่อน" });
    expect(mockDb.partner.findUnique).not.toHaveBeenCalled();
    expect(mockDb.adminUser.create).not.toHaveBeenCalled();
  });

  it("rejects a PARTNER pointing at a non-existent partner", async () => {
    mockDb.partner.findUnique.mockResolvedValueOnce(null);
    const res = await createAdmin(
      fd({ email: "p@x.com", password: "longenoughpw1", role: "PARTNER", partnerId: "ghost" }),
    );
    expect(res).toEqual({ ok: false, error: "ไม่พบ Partner ที่เลือก" });
    expect(mockDb.adminUser.create).not.toHaveBeenCalled();
  });

  it("creates a PARTNER linked to the chosen partner", async () => {
    mockDb.partner.findUnique.mockResolvedValueOnce({ id: "pt-1" });
    mockDb.adminUser.create.mockResolvedValueOnce({ id: "new-2" });
    const res = await createAdmin(
      fd({ email: "p@x.com", password: "longenoughpw1", role: "PARTNER", partnerId: "pt-1" }),
    );
    expect(res).toEqual({ ok: true });
    expect(mockDb.adminUser.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email:     "p@x.com",
        role:      "PARTNER",
        partnerId: "pt-1",
      }),
    });
  });
});

describe("updateAdmin · safety rails", () => {
  it("refuses to let an admin deactivate themselves", async () => {
    mockDb.adminUser.findUnique.mockResolvedValueOnce({
      id: "self-1", email: "self@admin.com", name: null, isActive: true,
    });
    const res = await updateAdmin(fd({ id: "self-1", name: "x", isActive: "false" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("ปิดบัญชีตัวเอง");
    expect(mockDb.adminUser.update).not.toHaveBeenCalled();
  });

  it("refuses to deactivate the LAST active admin", async () => {
    mockDb.adminUser.findUnique.mockResolvedValueOnce({
      id: "other-1", email: "other@admin.com", name: null, isActive: true,
    });
    mockDb.adminUser.count.mockResolvedValueOnce(1); // only one active
    const res = await updateAdmin(fd({ id: "other-1", name: "x", isActive: "false" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("admin active คนเดียว");
    expect(mockDb.adminUser.update).not.toHaveBeenCalled();
  });

  it("allows deactivating someone else when other admins remain", async () => {
    mockDb.adminUser.findUnique.mockResolvedValueOnce({
      id: "other-1", email: "other@admin.com", name: null, isActive: true,
    });
    mockDb.adminUser.count.mockResolvedValueOnce(3);
    mockDb.adminUser.update.mockResolvedValueOnce({});
    const res = await updateAdmin(fd({ id: "other-1", name: "x", isActive: "false" }));
    expect(res).toEqual({ ok: true });
    expect(mockDb.adminUser.update).toHaveBeenCalledWith({
      where: { id: "other-1" },
      data:  { name: "x", isActive: false },
    });
  });

  it("does NOT run the last-admin count check when only changing name", async () => {
    mockDb.adminUser.findUnique.mockResolvedValueOnce({
      id: "self-1", email: "self@admin.com", name: "Old", isActive: true,
    });
    mockDb.adminUser.update.mockResolvedValueOnce({});
    const res = await updateAdmin(fd({ id: "self-1", name: "New name", isActive: "true" }));
    expect(res).toEqual({ ok: true });
    expect(mockDb.adminUser.count).not.toHaveBeenCalled();
  });
});

describe("resetAdminPassword", () => {
  it("bumps tokenVersion on every reset (kicks all sessions)", async () => {
    mockDb.adminUser.findUnique.mockResolvedValueOnce({
      id: "other-1", email: "other@admin.com",
    });
    mockDb.adminUser.update.mockResolvedValueOnce({});
    const res = await resetAdminPassword(fd({ id: "other-1", password: "newpassword12" }));
    expect(res).toEqual({ ok: true });
    expect(mockDb.adminUser.update).toHaveBeenCalledWith({
      where: { id: "other-1" },
      data:  {
        passwordHash: "hashed:newpassword12",
        tokenVersion: { increment: 1 },
      },
    });
  });

  it("rejects a too-short new password", async () => {
    const res = await resetAdminPassword(fd({ id: "other-1", password: "short" }));
    expect(res.ok).toBe(false);
    expect(mockDb.adminUser.findUnique).not.toHaveBeenCalled();
    expect(mockDb.adminUser.update).not.toHaveBeenCalled();
  });
});

describe("forceLogoutAdmin", () => {
  it("refuses to target self (use the normal logout button instead)", async () => {
    const res = await forceLogoutAdmin("self-1");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("Logout");
    expect(mockDb.adminUser.update).not.toHaveBeenCalled();
  });

  it("bumps tokenVersion for someone else", async () => {
    mockDb.adminUser.findUnique.mockResolvedValueOnce({
      id: "other-1", email: "other@admin.com",
    });
    mockDb.adminUser.update.mockResolvedValueOnce({});
    const res = await forceLogoutAdmin("other-1");
    expect(res).toEqual({ ok: true });
    expect(mockDb.adminUser.update).toHaveBeenCalledWith({
      where: { id: "other-1" },
      data:  { tokenVersion: { increment: 1 } },
    });
  });
});

describe("forceLogoutAllAdmins", () => {
  it("bumps tokenVersion on every admin row (including the caller)", async () => {
    mockDb.adminUser.updateMany.mockResolvedValueOnce({ count: 4 });
    const res = await forceLogoutAllAdmins();
    expect(res).toEqual({ ok: true });
    expect(mockDb.adminUser.updateMany).toHaveBeenCalledWith({
      data: { tokenVersion: { increment: 1 } },
    });
  });
});
