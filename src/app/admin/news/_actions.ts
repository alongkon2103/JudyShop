"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { logAdmin } from "@/lib/audit";
import { uploadFile, deleteFileByPublicUrl } from "@/lib/storage";

const dateOrNull = (s: FormDataEntryValue | null) => {
  if (typeof s !== "string" || !s.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const Input = z.object({
  titleEn:   z.string().min(1).max(160),
  titleTh:   z.string().min(1).max(160),
  excerptEn: z.string().max(500).optional().or(z.literal("")),
  excerptTh: z.string().max(500).optional().or(z.literal("")),
  category:  z.enum(["UPDATE", "ANNOUNCE", "EVENT", "MAINTENANCE"]).default("ANNOUNCE"),
});

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

async function maybeUploadNewsImage(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image too large (max 6 MB).");
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed.");
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
  const path = `news/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
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
    titleEn:   formData.get("titleEn") ?? "",
    titleTh:   formData.get("titleTh") ?? "",
    excerptEn: formData.get("excerptEn") ?? "",
    excerptTh: formData.get("excerptTh") ?? "",
    category:  formData.get("category") ?? "ANNOUNCE",
  });
  if (!parsed.success) throw new Error("Invalid input");
  const d = parsed.data;
  return {
    titleEn:     d.titleEn,
    titleTh:     d.titleTh,
    excerptEn:   d.excerptEn?.trim() || null,
    excerptTh:   d.excerptTh?.trim() || null,
    category:    d.category,
    publishedAt: dateOrNull(formData.get("publishedAt")),
    isPublished: formData.get("isPublished") !== "off",
  };
}

function bumpPaths() {
  revalidatePath("/admin/news");
  revalidatePath("/news");
}

// ── Create ────────────────────────────────────────────────────

export async function createNews(formData: FormData) {
  const session = await requireAdmin();
  const base = parseBaseFields(formData);
  const imageUrl = await maybeUploadNewsImage(pickFile(formData, "image"));

  const row = await db.news.create({
    data: {
      ...base,
      publishedAt: base.publishedAt ?? new Date(),
      imageUrl,
      createdBy: session.email,
    },
  });
  await logAdmin({
    action: "news.create",
    targetType: "news",
    targetId: row.id,
    payload: { titleEn: base.titleEn, category: base.category },
  });
  bumpPaths();
}

// ── Update ────────────────────────────────────────────────────

export async function updateNews(id: string, formData: FormData) {
  await requireAdmin();
  const existing = await db.news.findUnique({ where: { id } });
  if (!existing) throw new Error("Not found");

  const base = parseBaseFields(formData);
  const newFile = pickFile(formData, "image");
  const removeImage = formData.get("removeImage") === "on";

  let imageUrl: string | null | undefined;
  if (newFile) {
    imageUrl = await maybeUploadNewsImage(newFile);
    if (existing.imageUrl) await deleteFileByPublicUrl(existing.imageUrl);
  } else if (removeImage) {
    imageUrl = null;
    if (existing.imageUrl) await deleteFileByPublicUrl(existing.imageUrl);
  }

  await db.news.update({
    where: { id },
    data: {
      ...base,
      publishedAt: base.publishedAt ?? existing.publishedAt,
      ...(imageUrl !== undefined && { imageUrl }),
    },
  });
  await logAdmin({
    action: "news.update",
    targetType: "news",
    targetId: id,
    payload: { titleEn: base.titleEn, category: base.category, isPublished: base.isPublished },
  });
  bumpPaths();
  redirect("/admin/news");
}

// ── Toggle / Delete ───────────────────────────────────────────

export async function setNewsPublished(id: string, published: boolean) {
  await requireAdmin();
  await db.news.update({ where: { id }, data: { isPublished: published } });
  await logAdmin({
    action: published ? "news.publish" : "news.unpublish",
    targetType: "news",
    targetId: id,
  });
  bumpPaths();
}

export async function deleteNews(id: string) {
  await requireAdmin();
  const row = await db.news.findUnique({ where: { id } });
  if (row?.imageUrl) {
    await deleteFileByPublicUrl(row.imageUrl);
  }
  await db.news.delete({ where: { id } });
  await logAdmin({
    action: "news.delete",
    targetType: "news",
    targetId: id,
    payload: row ? { titleEn: row.titleEn } : undefined,
  });
  bumpPaths();
}
