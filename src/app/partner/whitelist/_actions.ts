"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePartner } from "@/lib/admin-session";
import { logAdmin } from "@/lib/audit";

/**
 * Partner-scoped whitelist mutations. Same shape/behaviour as the admin
 * whitelist actions (src/app/admin/whitelist/_actions.ts) but every write
 * is gated on `partnerOwnsProduct`: a partner may only add/edit/delete
 * whitelist rows on the games they hold a ProductPartner share in. The
 * ownership check is the security boundary — the UI already hides other
 * games, but the server never trusts that.
 */

const CreateInput = z.object({
  productId:    z.string().min(1).max(50),
  username:     z.string().min(1).max(100),
  isLifetime:   z.boolean().optional(),
  durationDays: z.coerce.number().int().min(0).max(36500).optional(),
  label:        z.string().max(200).optional().or(z.literal("")),
});

const UpdateInput = z.object({
  id:         z.string().min(1).max(50),
  username:   z.string().min(1).max(100),
  isLifetime: z.boolean(),
  expireDate: z.string().max(40).optional().or(z.literal("")),
  label:      z.string().max(200).optional().or(z.literal("")),
});

/** True iff `productId` is one of the partner's games. */
async function partnerOwnsProduct(partnerId: string, productId: string): Promise<boolean> {
  const link = await db.productPartner.findUnique({
    where: { productId_partnerId: { productId, partnerId } },
    select: { productId: true },
  });
  return !!link;
}

export async function createPartnerWhitelist(formData: FormData): Promise<void> {
  const session = await requirePartner();
  const isLifetime = formData.get("isLifetime") === "on";
  const parsed = CreateInput.safeParse({
    productId:    String(formData.get("productId") ?? ""),
    username:     String(formData.get("username") ?? "").trim(),
    durationDays: formData.get("durationDays") ?? undefined,
    label:        formData.get("label") ?? "",
    isLifetime,
  });
  if (!parsed.success) throw new Error("Invalid input");
  const d = parsed.data;

  if (!(await partnerOwnsProduct(session.partnerId, d.productId))) {
    throw new Error("ไม่มีสิทธิ์เพิ่ม whitelist ให้เกมนี้");
  }

  if (!isLifetime && !d.durationDays) {
    throw new Error("กรุณาระบุจำนวนวัน หรือเลือก Lifetime");
  }

  const expireDate = isLifetime
    ? null
    : new Date(Date.now() + (d.durationDays ?? 0) * 24 * 60 * 60 * 1000);

  const row = await db.whitelist.upsert({
    where: { productId_username: { productId: d.productId, username: d.username } },
    update: {
      expireDate,
      isLifetime,
      label:   d.label?.trim() || null,
      source:  "MANUAL",
      addedBy: session.email,
    },
    create: {
      productId: d.productId,
      username:  d.username,
      expireDate,
      isLifetime,
      label:   d.label?.trim() || null,
      source:  "MANUAL",
      addedBy: session.email,
    },
  });

  await logAdmin({
    action: "whitelist.upsert",
    targetType: "whitelist",
    targetId: row.id,
    payload: {
      productId:  d.productId,
      username:   d.username,
      isLifetime,
      expireDate: expireDate?.toISOString() ?? null,
      by:         "partner",
      partnerId:  session.partnerId,
    },
  });
  revalidatePath("/partner/whitelist");
}

export async function updatePartnerWhitelist(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await requirePartner();
  const isLifetime = formData.get("isLifetime") === "on";
  const parsed = UpdateInput.safeParse({
    id:         String(formData.get("id") ?? ""),
    username:   String(formData.get("username") ?? "").trim(),
    isLifetime,
    expireDate: String(formData.get("expireDate") ?? ""),
    label:      String(formData.get("label") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const d = parsed.data;

  const existing = await db.whitelist.findUnique({
    where: { id: d.id },
    select: {
      id: true,
      productId: true,
      username: true,
      isLifetime: true,
      expireDate: true,
      label: true,
    },
  });
  if (!existing) return { ok: false, error: "ไม่พบรายการ" };
  if (!(await partnerOwnsProduct(session.partnerId, existing.productId))) {
    return { ok: false, error: "ไม่มีสิทธิ์แก้ไขรายการนี้" };
  }

  // Resolve new expiry — mirrors the admin action.
  let nextExpire: Date | null;
  if (d.isLifetime) {
    nextExpire = null;
  } else {
    if (!d.expireDate) {
      return { ok: false, error: "กรุณาตั้งวันหมดอายุ หรือเลือก Lifetime" };
    }
    const parsedDate = new Date(d.expireDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return { ok: false, error: "รูปแบบวันที่ไม่ถูกต้อง" };
    }
    const maxAllowed = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
    if (parsedDate > maxAllowed) {
      return { ok: false, error: "วันหมดอายุเกิน 100 ปี — เลือก Lifetime แทน" };
    }
    nextExpire = parsedDate;
  }

  // Username rename collision on (productId, username).
  if (d.username !== existing.username) {
    const clash = await db.whitelist.findUnique({
      where: { productId_username: { productId: existing.productId, username: d.username } },
      select: { id: true },
    });
    if (clash && clash.id !== existing.id) {
      return { ok: false, error: `มี "${d.username}" ในเกมนี้อยู่แล้ว` };
    }
  }

  await db.whitelist.update({
    where: { id: d.id },
    data: {
      username:   d.username,
      isLifetime: d.isLifetime,
      expireDate: nextExpire,
      label:      d.label?.trim() || null,
    },
  });

  await logAdmin({
    action: "whitelist.update",
    targetType: "whitelist",
    targetId: existing.id,
    payload: {
      before: {
        username:   existing.username,
        isLifetime: existing.isLifetime,
        expireDate: existing.expireDate?.toISOString() ?? null,
        label:      existing.label,
      },
      after: {
        username:   d.username,
        isLifetime: d.isLifetime,
        expireDate: nextExpire?.toISOString() ?? null,
        label:      d.label?.trim() || null,
      },
      by:        "partner",
      partnerId: session.partnerId,
    },
  });

  revalidatePath("/partner/whitelist");
  return { ok: true };
}

export async function deletePartnerWhitelist(id: string): Promise<void> {
  const session = await requirePartner();
  const existing = await db.whitelist.findUnique({
    where: { id },
    select: { productId: true, username: true, isLifetime: true },
  });
  if (!existing) return; // already gone — treat as success
  if (!(await partnerOwnsProduct(session.partnerId, existing.productId))) {
    throw new Error("ไม่มีสิทธิ์ลบรายการนี้");
  }

  await db.whitelist.delete({ where: { id } });
  await logAdmin({
    action: "whitelist.delete",
    targetType: "whitelist",
    targetId: id,
    payload: { ...existing, by: "partner", partnerId: session.partnerId },
  });
  revalidatePath("/partner/whitelist");
}
