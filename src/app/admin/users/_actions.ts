"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { logAdmin } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";

// Password rules — length-first per NIST guidance. Bcrypt + rate
// limiting protect against brute force, so we don't impose complexity
// rules that just frustrate users into picking memorable junk.
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;

// Trim + lowercase BEFORE running the email check — admins commonly
// paste with stray whitespace and we shouldn't reject those outright.
const EmailSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.string().min(3).max(200).email(),
);

const PasswordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

// A new login is either a full ADMIN or a scoped PARTNER. PARTNER rows
// must name the Partner they represent; ADMIN rows never carry one (the
// action nulls it out regardless of what the form sent).
const CreateInput = z
  .object({
    email:     EmailSchema,
    name:      z.string().max(100).optional().or(z.literal("")),
    password:  PasswordSchema,
    role:      z.enum(["ADMIN", "PARTNER"]),
    partnerId: z.string().max(50).optional().or(z.literal("")),
  })
  .refine((d) => d.role === "ADMIN" || !!d.partnerId, {
    path: ["partnerId"],
    message: "partner_required",
  });

const UpdateInput = z.object({
  id:       z.string().min(1).max(50),
  name:     z.string().max(100).optional().or(z.literal("")),
  isActive: z.boolean(),
});

const ResetPasswordInput = z.object({
  id:       z.string().min(1).max(50),
  password: PasswordSchema,
});

export type AdminActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Create a new admin. Email is unique + lowercased. Anyone with an
 * admin session may invite — there are no roles; all admins are peers.
 */
export async function createAdmin(formData: FormData): Promise<AdminActionResult> {
  const session = await requireAdmin();
  const parsed = CreateInput.safeParse({
    email:     String(formData.get("email") ?? ""),
    name:      String(formData.get("name") ?? "").trim(),
    password:  String(formData.get("password") ?? ""),
    role:      String(formData.get("role") ?? "ADMIN"),
    partnerId: String(formData.get("partnerId") ?? ""),
  });
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    // Surface clear messages for the most common failures.
    if (firstIssue?.path[0] === "email") return { ok: false, error: "Email ไม่ถูกต้อง" };
    if (firstIssue?.path[0] === "password") {
      return { ok: false, error: `Password ต้องยาวอย่างน้อย ${PASSWORD_MIN} ตัว` };
    }
    if (firstIssue?.path[0] === "partnerId") {
      return { ok: false, error: "เลือก Partner ให้ผู้ใช้ที่เป็น Partner ก่อน" };
    }
    return { ok: false, error: "Invalid input" };
  }

  // ADMIN rows never carry a partnerId; PARTNER rows must point at a real
  // Partner. Validate the link exists up front so we never persist a
  // PARTNER login pointing at a deleted / mistyped id.
  let partnerId: string | null = null;
  if (parsed.data.role === "PARTNER") {
    const partner = await db.partner.findUnique({
      where: { id: parsed.data.partnerId as string },
      select: { id: true },
    });
    if (!partner) return { ok: false, error: "ไม่พบ Partner ที่เลือก" };
    partnerId = partner.id;
  }

  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const created = await db.adminUser.create({
      data: {
        email:        parsed.data.email,
        name:         parsed.data.name || null,
        passwordHash,
        isActive:     true,
        tokenVersion: 0,
        role:         parsed.data.role,
        partnerId,
      },
    });

    await logAdmin({
      action:     "admin.create",
      targetType: "admin",
      targetId:   created.id,
      payload: {
        email:     parsed.data.email,
        name:      parsed.data.name || null,
        role:      parsed.data.role,
        partnerId,
        createdBy: session.email,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "Email นี้มีอยู่แล้ว" };
    }
    throw err;
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Update name / active state. Two safety rails protect against
 * accidentally locking everyone out of the admin panel:
 *   1. you cannot deactivate yourself (it would lock you out mid-action)
 *   2. you cannot deactivate the LAST remaining active admin
 *
 * Email is intentionally not editable — admins create a new account
 * and disable the old one instead, which keeps the audit trail clean.
 */
export async function updateAdmin(formData: FormData): Promise<AdminActionResult> {
  const session = await requireAdmin();
  const parsed = UpdateInput.safeParse({
    id:       String(formData.get("id") ?? ""),
    name:     String(formData.get("name") ?? "").trim(),
    isActive: formData.get("isActive") === "true",
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const before = await db.adminUser.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, email: true, name: true, isActive: true },
  });
  if (!before) return { ok: false, error: "Admin not found" };

  // Rail 1 — self-deactivate
  if (!parsed.data.isActive && before.id === session.sub) {
    return { ok: false, error: "ปิดบัญชีตัวเองไม่ได้ — ให้ admin คนอื่นปิดให้" };
  }

  // Rail 2 — last active admin
  if (!parsed.data.isActive && before.isActive) {
    const activeCount = await db.adminUser.count({ where: { isActive: true } });
    if (activeCount <= 1) {
      return {
        ok: false,
        error: "เหลือ admin active คนเดียว — สร้างคนใหม่ก่อนแล้วค่อยปิดคนนี้",
      };
    }
  }

  await db.adminUser.update({
    where: { id: parsed.data.id },
    data: {
      name:     parsed.data.name || null,
      isActive: parsed.data.isActive,
    },
  });

  await logAdmin({
    action:     "admin.update",
    targetType: "admin",
    targetId:   parsed.data.id,
    payload: {
      targetEmail: before.email,
      before:      { name: before.name, isActive: before.isActive },
      after:       { name: parsed.data.name || null, isActive: parsed.data.isActive },
      editedBy:    session.email,
    },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Set a new password. Always bumps `tokenVersion` so any active
 * session for the target (in another browser, the target's own device,
 * an attacker's stolen cookie) is invalidated on the next request.
 *
 * Resetting your own password logs you out — by design. The audit trail
 * is cleaner that way, and the next login proves you still know the
 * new password.
 */
export async function resetAdminPassword(formData: FormData): Promise<AdminActionResult> {
  const session = await requireAdmin();
  const parsed = ResetPasswordInput.safeParse({
    id:       String(formData.get("id") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: `Password ต้องยาวอย่างน้อย ${PASSWORD_MIN} ตัว` };
  }

  const before = await db.adminUser.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, email: true },
  });
  if (!before) return { ok: false, error: "Admin not found" };

  const passwordHash = await hashPassword(parsed.data.password);

  await db.adminUser.update({
    where: { id: parsed.data.id },
    data: {
      passwordHash,
      tokenVersion: { increment: 1 },
    },
  });

  await logAdmin({
    action:     "admin.password_reset",
    targetType: "admin",
    targetId:   parsed.data.id,
    payload: {
      targetEmail: before.email,
      resetBy:     session.email,
      self:        before.id === session.sub,
    },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Bump a single admin's tokenVersion — kicks them out of every active
 * session without changing their password. Use when an admin reports a
 * lost device or you suspect their cookie was stolen.
 *
 * Cannot target yourself; use the normal logout button for that.
 */
export async function forceLogoutAdmin(id: string): Promise<AdminActionResult> {
  const session = await requireAdmin();
  if (id === session.sub) {
    return { ok: false, error: "ใช้ปุ่ม Logout บน topbar สำหรับตัวเอง" };
  }

  const before = await db.adminUser.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!before) return { ok: false, error: "Admin not found" };

  await db.adminUser.update({
    where: { id },
    data: { tokenVersion: { increment: 1 } },
  });

  await logAdmin({
    action:     "admin.force_logout",
    targetType: "admin",
    targetId:   id,
    payload: { targetEmail: before.email, forcedBy: session.email },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Nuke every admin session — useful during an incident where you're
 * not sure which credentials are compromised. The caller is included
 * (their next request will hit `requireAdmin()` and redirect to login),
 * which is intentional: an incident response should force everyone,
 * including the responder, to re-authenticate.
 */
export async function forceLogoutAllAdmins(): Promise<AdminActionResult> {
  const session = await requireAdmin();

  const result = await db.adminUser.updateMany({
    data: { tokenVersion: { increment: 1 } },
  });

  await logAdmin({
    action: "admin.force_logout_all",
    payload: {
      affected: result.count,
      forcedBy: session.email,
    },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
