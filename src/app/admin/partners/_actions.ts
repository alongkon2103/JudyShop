"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { logAdmin } from "@/lib/audit";

const CreateInput = z.object({
  name:    z.string().min(1).max(100),
  contact: z.string().max(200).optional().or(z.literal("")),
  note:    z.string().max(500).optional().or(z.literal("")),
});

const UpdateInput = CreateInput.extend({
  id: z.string().min(1).max(50),
});

export type PartnerResult =
  | { ok: true }
  | { ok: false; error: string };

/** Create a new business partner. Free-form name + contact. */
export async function createPartner(formData: FormData): Promise<PartnerResult> {
  const session = await requireAdmin();
  const parsed = CreateInput.safeParse({
    name:    String(formData.get("name") ?? "").trim(),
    contact: String(formData.get("contact") ?? "").trim(),
    note:    String(formData.get("note") ?? "").trim(),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const partner = await db.partner.create({
    data: {
      name:    parsed.data.name,
      contact: parsed.data.contact || null,
      note:    parsed.data.note || null,
    },
  });

  await logAdmin({
    action: "partner.create",
    targetType: "partner",
    targetId: partner.id,
    payload: {
      name: parsed.data.name,
      contact: parsed.data.contact || null,
      createdBy: session.email,
    },
  });

  revalidatePath("/admin/partners");
  return { ok: true };
}

export async function updatePartner(formData: FormData): Promise<PartnerResult> {
  const session = await requireAdmin();
  const parsed = UpdateInput.safeParse({
    id:      String(formData.get("id") ?? ""),
    name:    String(formData.get("name") ?? "").trim(),
    contact: String(formData.get("contact") ?? "").trim(),
    note:    String(formData.get("note") ?? "").trim(),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const before = await db.partner.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { ok: false, error: "Partner not found" };

  await db.partner.update({
    where: { id: parsed.data.id },
    data: {
      name:    parsed.data.name,
      contact: parsed.data.contact || null,
      note:    parsed.data.note || null,
    },
  });

  await logAdmin({
    action: "partner.update",
    targetType: "partner",
    targetId: parsed.data.id,
    payload: {
      before: { name: before.name, contact: before.contact, note: before.note },
      after:  { name: parsed.data.name, contact: parsed.data.contact || null, note: parsed.data.note || null },
      editedBy: session.email,
    },
  });

  revalidatePath("/admin/partners");
  return { ok: true };
}

/**
 * Delete a partner. The DB has `ON DELETE RESTRICT` on `ProductPartner →
 * Partner`, so any partner that still owns a share row will trigger a
 * Prisma `P2003` foreign-key error. We translate that into a friendly
 * "remove their shares first" message instead of a 500.
 */
export async function deletePartner(id: string): Promise<PartnerResult> {
  const session = await requireAdmin();
  const before = await db.partner.findUnique({
    where: { id },
    include: { _count: { select: { shares: true } } },
  });
  if (!before) return { ok: false, error: "Partner not found" };

  if (before._count.shares > 0) {
    return {
      ok: false,
      error: `ยังลบไม่ได้ — Partner นี้ถือสิทธิ์อยู่ใน ${before._count.shares} เกม ลบ share ออกจากทุกเกมก่อน`,
    };
  }

  try {
    await db.partner.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return {
        ok: false,
        error: "ลบไม่ได้ Partner ยังถือสิทธิ์อยู่ในบาง product — ลบ share ก่อน",
      };
    }
    throw err;
  }

  await logAdmin({
    action: "partner.delete",
    targetType: "partner",
    targetId: id,
    payload: { name: before.name, deletedBy: session.email },
  });

  revalidatePath("/admin/partners");
  return { ok: true };
}
