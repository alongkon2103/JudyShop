"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { logAdmin } from "@/lib/audit";
import { uploadFile, deleteFileByPublicUrl } from "@/lib/storage";
import { validateImage } from "@/lib/upload-constraints";

const dateOrNull = (s: FormDataEntryValue | null) => {
  if (typeof s !== "string" || !s.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const Input = z.object({
  messageEn: z.string().max(500).optional().or(z.literal("")),
  messageTh: z.string().max(500).optional().or(z.literal("")),
  priority:  z.coerce.number().int().min(0).max(999).default(0),
});

function bumpPaths() {
  revalidatePath("/admin/announcements");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/news");
}

async function maybeUploadAnnouncementImage(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const check = validateImage(file);
  if (!check.ok) throw new Error(check.error);
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
  const path = `announcements/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await uploadFile({ path, file });
  if (!res.ok) throw new Error(res.error);
  return res.url;
}

function pickFile(formData: FormData, name: string): File | null {
  const f = formData.get(name);
  return f instanceof File && f.size > 0 ? f : null;
}

function parseBaseFields(formData: FormData) {
  const parsed = Input.safeParse({
    messageEn: formData.get("messageEn") ?? "",
    messageTh: formData.get("messageTh") ?? "",
    priority:  formData.get("priority")  ?? "0",
  });
  if (!parsed.success) throw new Error("Invalid input");
  return {
    messageEn: parsed.data.messageEn?.trim() || null,
    messageTh: parsed.data.messageTh?.trim() || null,
    priority:  parsed.data.priority,
    startDate: dateOrNull(formData.get("startDate")),
    endDate:   dateOrNull(formData.get("endDate")),
    isActive:  formData.get("isActive") !== "off",
  };
}

// ── Create ────────────────────────────────────────────────────

export async function createAnnouncement(formData: FormData) {
  const session = await requireAdmin();
  const base = parseBaseFields(formData);
  const file = pickFile(formData, "image");

  if (!base.messageEn && !base.messageTh && !file) {
    throw new Error("Please provide a message or an image (or both).");
  }

  const imageUrl = await maybeUploadAnnouncementImage(file);

  const row = await db.announcement.create({
    data: {
      messageEn: base.messageEn,
      messageTh: base.messageTh,
      imageUrl,
      startDate: base.startDate ?? new Date(),
      endDate:   base.endDate,
      isActive:  base.isActive,
      priority:  base.priority,
      createdBy: session.email,
    },
  });
  await logAdmin({
    action: "announcement.create",
    targetType: "announcement",
    targetId: row.id,
    payload: { isActive: base.isActive, priority: base.priority },
  });
  bumpPaths();
}

// ── Update ────────────────────────────────────────────────────

export async function updateAnnouncement(id: string, formData: FormData) {
  await requireAdmin();
  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) throw new Error("Not found");

  const base = parseBaseFields(formData);
  const newFile = pickFile(formData, "image");
  const removeImage = formData.get("removeImage") === "on";

  // imageUrl: undefined = keep, null = remove, string = replace
  let imageUrl: string | null | undefined;
  if (newFile) {
    imageUrl = await maybeUploadAnnouncementImage(newFile);
    if (existing.imageUrl) await deleteFileByPublicUrl(existing.imageUrl);
  } else if (removeImage) {
    imageUrl = null;
    if (existing.imageUrl) await deleteFileByPublicUrl(existing.imageUrl);
  }

  const willHaveImage = imageUrl !== undefined ? !!imageUrl : !!existing.imageUrl;
  if (!base.messageEn && !base.messageTh && !willHaveImage) {
    throw new Error("Please provide a message or an image (or both).");
  }

  await db.announcement.update({
    where: { id },
    data: {
      messageEn: base.messageEn,
      messageTh: base.messageTh,
      ...(imageUrl !== undefined && { imageUrl }),
      startDate: base.startDate ?? existing.startDate,
      endDate:   base.endDate,
      isActive:  base.isActive,
      priority:  base.priority,
    },
  });
  await logAdmin({
    action: "announcement.update",
    targetType: "announcement",
    targetId: id,
    payload: { isActive: base.isActive, priority: base.priority },
  });
  bumpPaths();
  redirect("/admin/announcements");
}

// ── Toggle / Delete ───────────────────────────────────────────

export async function setAnnouncementActive(id: string, active: boolean) {
  await requireAdmin();
  await db.announcement.update({ where: { id }, data: { isActive: active } });
  await logAdmin({
    action: active ? "announcement.activate" : "announcement.deactivate",
    targetType: "announcement",
    targetId: id,
  });
  bumpPaths();
}

export async function deleteAnnouncement(id: string) {
  await requireAdmin();
  const row = await db.announcement.findUnique({ where: { id } });
  if (row?.imageUrl) {
    await deleteFileByPublicUrl(row.imageUrl);
  }
  await db.announcement.delete({ where: { id } });
  await logAdmin({
    action: "announcement.delete",
    targetType: "announcement",
    targetId: id,
    payload: row ? { messageEn: row.messageEn } : undefined,
  });
  bumpPaths();
}
