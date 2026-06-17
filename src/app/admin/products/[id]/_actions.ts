"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { uploadFile, deleteFileByPublicUrl } from "@/lib/storage";
import { convertThbToUsd, getThbToUsdRate } from "@/lib/fx";

const opt = (s: FormDataEntryValue | null) => {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length ? t : null;
};
const str = (s: FormDataEntryValue | null) => (typeof s === "string" ? s : "");
const num = (s: FormDataEntryValue | null, fallback = 0) => {
  if (typeof s !== "string") return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

// ── FX preview (used by Plan form's "Refresh rate" button) ────

export async function previewUsdRate() {
  await requireAdmin();
  return getThbToUsdRate();
}

// ── Plans ─────────────────────────────────────────────────────

const PlanSchema = z.object({
  labelEn:      z.string().min(1).max(80),
  labelTh:      z.string().min(1).max(80),
  durationDays: z.coerce.number().int().min(0).max(36500).optional(),
  isLifetime:   z.boolean().optional(),
  priceTHB:     z.coerce.number().min(0).max(10_000_000),
  priceUSD:     z.coerce.number().min(0).max(10_000_000),
  usdAuto:      z.boolean().optional(),
  isActive:     z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).max(99999).default(0),
});

async function buildPlanData(formData: FormData) {
  const isLifetime = formData.get("isLifetime") === "on";
  const isActive   = formData.get("isActive") === "on";
  const usdAuto    = formData.get("usdAuto") === "on";

  const parsed = PlanSchema.safeParse({
    labelEn:      str(formData.get("labelEn")),
    labelTh:      str(formData.get("labelTh")),
    durationDays: formData.get("durationDays") ?? undefined,
    priceTHB:     str(formData.get("priceTHB")),
    priceUSD:     str(formData.get("priceUSD")) || "0",
    displayOrder: str(formData.get("displayOrder")) || "0",
    isLifetime,
    isActive,
    usdAuto,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map(i => i.message).join("; "));
  const d = parsed.data;

  // Auto-derive USD from THB via the live FX rate when requested.
  let priceUSD = d.priceUSD;
  if (usdAuto) {
    const { usd } = await convertThbToUsd(d.priceTHB);
    priceUSD = usd;
  }

  return {
    labelEn: d.labelEn,
    labelTh: d.labelTh,
    durationDays: isLifetime ? null : d.durationDays ?? null,
    isLifetime,
    priceTHB: new Prisma.Decimal(d.priceTHB.toFixed(2)),
    priceUSD: new Prisma.Decimal(priceUSD.toFixed(2)),
    usdAuto,
    isActive,
    displayOrder: d.displayOrder,
  } as const;
}

export async function createPlan(productId: string, formData: FormData) {
  await requireAdmin();
  const data = await buildPlanData(formData);
  await db.plan.create({ data: { productId, ...data } });
  revalidatePath(`/admin/products/${productId}/plans`);
  revalidatePath(`/admin/products/${productId}`);
}

export async function updatePlan(productId: string, planId: string, formData: FormData) {
  await requireAdmin();
  const data = await buildPlanData(formData);
  await db.plan.update({ where: { id: planId }, data });
  revalidatePath(`/admin/products/${productId}/plans`);
}

export async function deletePlan(productId: string, planId: string) {
  await requireAdmin();
  await db.plan.delete({ where: { id: planId } });
  revalidatePath(`/admin/products/${productId}/plans`);
  revalidatePath(`/admin/products/${productId}`);
}

export async function movePlan(productId: string, planId: string, direction: "up" | "down") {
  await requireAdmin();
  await reorder("plan", productId, planId, direction);
  revalidatePath(`/admin/products/${productId}/plans`);
  revalidatePath(`/admin/products/${productId}`);
}

// ── Images / Overlays — shared upload helpers ─────────────────

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6MB

async function maybeUpload(productId: string, kind: "images" | "overlays", file: File | null) {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image too large (max 6 MB).");
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed.");
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
  const path = `products/${productId}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await uploadFile({ path, file });
  if (!res.ok) throw new Error(res.error);
  return res;
}

function pickFile(formData: FormData, name: string): File | null {
  const f = formData.get(name);
  return f instanceof File && f.size > 0 ? f : null;
}

// ── Helpers shared by minimal upload forms ────────────────────

/** Strip extension and clean up to a reasonable display name. */
function baseNameFromFile(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 80) || "Untitled";
}

async function nextDisplayOrder(table: "productImage" | "giftOverlay" | "preset", productId: string) {
  const args = {
    where: { productId },
    orderBy: { displayOrder: "desc" as const },
    select: { displayOrder: true },
  };
  const row =
    table === "productImage" ? await db.productImage.findFirst(args)
    : table === "giftOverlay" ? await db.giftOverlay.findFirst(args)
    : await db.preset.findFirst(args);
  return (row?.displayOrder ?? -1) + 1;
}

// ── ProductImage CRUD ─────────────────────────────────────────

export async function createImage(productId: string, formData: FormData) {
  await requireAdmin();
  const file = pickFile(formData, "file");
  if (!file) throw new Error("Please choose an image file.");
  const isThumbnail = formData.get("isThumbnail") === "on";

  const upload = await maybeUpload(productId, "images", file);
  if (!upload) throw new Error("Upload failed.");

  const displayOrder = await nextDisplayOrder("productImage", productId);

  if (isThumbnail) {
    await db.productImage.updateMany({
      where: { productId, isThumbnail: true },
      data: { isThumbnail: false },
    });
  }
  await db.productImage.create({
    data: { productId, url: upload.url, displayOrder, isThumbnail },
  });
  revalidatePath(`/admin/products/${productId}/images`);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products`);
}

export async function setImageThumbnail(productId: string, imageId: string) {
  await requireAdmin();
  await db.productImage.updateMany({
    where: { productId, isThumbnail: true, NOT: { id: imageId } },
    data: { isThumbnail: false },
  });
  await db.productImage.update({ where: { id: imageId }, data: { isThumbnail: true } });
  revalidatePath(`/admin/products/${productId}/images`);
  revalidatePath(`/admin/products`);
}

export async function deleteImage(productId: string, imageId: string) {
  await requireAdmin();
  const img = await db.productImage.findUnique({ where: { id: imageId } });
  if (img) {
    await deleteFileByPublicUrl(img.url);
    await db.productImage.delete({ where: { id: imageId } });
  }
  revalidatePath(`/admin/products/${productId}/images`);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products`);
}

export async function moveImage(productId: string, imageId: string, direction: "up" | "down") {
  await requireAdmin();
  await reorder("productImage", productId, imageId, direction);
  revalidatePath(`/admin/products/${productId}/images`);
}

// ── GiftOverlay CRUD ──────────────────────────────────────────

export async function createOverlay(productId: string, formData: FormData) {
  await requireAdmin();
  const file = pickFile(formData, "file");
  if (!file) throw new Error("Please choose an image file.");

  const upload = await maybeUpload(productId, "overlays", file);
  if (!upload) throw new Error("Upload failed.");

  const providedName = str(formData.get("name")).trim();
  const giftName = providedName || baseNameFromFile(file.name);
  const isActive = formData.get("isActive") !== "off"; // default on

  const displayOrder = await nextDisplayOrder("giftOverlay", productId);

  await db.giftOverlay.create({
    data: {
      productId,
      giftNameEn: giftName,
      giftNameTh: giftName,
      imageUrl: upload.url,
      displayOrder,
      isActive,
    },
  });
  revalidatePath(`/admin/products/${productId}/overlays`);
  revalidatePath(`/admin/products/${productId}`);
}

export async function deleteOverlay(productId: string, overlayId: string) {
  await requireAdmin();
  const row = await db.giftOverlay.findUnique({ where: { id: overlayId } });
  if (row) {
    await deleteFileByPublicUrl(row.imageUrl);
    await db.giftOverlay.delete({ where: { id: overlayId } });
  }
  revalidatePath(`/admin/products/${productId}/overlays`);
  revalidatePath(`/admin/products/${productId}`);
}

export async function moveOverlay(productId: string, overlayId: string, direction: "up" | "down") {
  await requireAdmin();
  await reorder("giftOverlay", productId, overlayId, direction);
  revalidatePath(`/admin/products/${productId}/overlays`);
}

// ── Reorder helper (swap displayOrder with neighbour) ─────────

async function reorder(
  table: "productImage" | "giftOverlay" | "preset" | "plan",
  productId: string,
  rowId: string,
  direction: "up" | "down",
) {
  const args = {
    where: { productId },
    orderBy: { displayOrder: "asc" as const },
    select: { id: true, displayOrder: true },
  };
  const items: { id: string; displayOrder: number }[] =
    table === "productImage" ? await db.productImage.findMany(args)
    : table === "giftOverlay" ? await db.giftOverlay.findMany(args)
    : table === "preset"      ? await db.preset.findMany(args)
    : await db.plan.findMany(args);

  const idx = items.findIndex((i) => i.id === rowId);
  if (idx === -1) return;
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= items.length) return;

  const a = items[idx];
  const b = items[targetIdx];

  if (table === "productImage") {
    await db.$transaction([
      db.productImage.update({ where: { id: a.id }, data: { displayOrder: b.displayOrder } }),
      db.productImage.update({ where: { id: b.id }, data: { displayOrder: a.displayOrder } }),
    ]);
  } else if (table === "giftOverlay") {
    await db.$transaction([
      db.giftOverlay.update({ where: { id: a.id }, data: { displayOrder: b.displayOrder } }),
      db.giftOverlay.update({ where: { id: b.id }, data: { displayOrder: a.displayOrder } }),
    ]);
  } else if (table === "preset") {
    await db.$transaction([
      db.preset.update({ where: { id: a.id }, data: { displayOrder: b.displayOrder } }),
      db.preset.update({ where: { id: b.id }, data: { displayOrder: a.displayOrder } }),
    ]);
  } else {
    await db.$transaction([
      db.plan.update({ where: { id: a.id }, data: { displayOrder: b.displayOrder } }),
      db.plan.update({ where: { id: b.id }, data: { displayOrder: a.displayOrder } }),
    ]);
  }
}

// ── Preset CRUD ───────────────────────────────────────────────

const MAX_PRESET_BYTES = 50 * 1024 * 1024; // 50MB

async function uploadPreset(productId: string, file: File) {
  if (file.size > MAX_PRESET_BYTES) throw new Error("File too large (max 50 MB).");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const path = `products/${productId}/presets/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const res = await uploadFile({ path, file });
  if (!res.ok) throw new Error(res.error);
  return res;
}

export async function createPreset(productId: string, formData: FormData) {
  await requireAdmin();

  const file = pickFile(formData, "file");
  if (!file) throw new Error("Please choose a file.");

  const upload = await uploadPreset(productId, file);
  const providedName = str(formData.get("name")).trim();
  const name = providedName || baseNameFromFile(file.name);
  const isActive = formData.get("isActive") !== "off"; // default on
  const targetProgram = opt(formData.get("targetProgram"));

  const displayOrder = await nextDisplayOrder("preset", productId);

  await db.preset.create({
    data: {
      productId,
      nameEn: name,
      nameTh: name,
      fileUrl: upload.url,
      fileName: file.name,
      mimeType: upload.mimeType,
      fileSize: upload.size,
      targetProgram,
      displayOrder,
      isActive,
    },
  });
  revalidatePath(`/admin/products/${productId}/presets`);
  revalidatePath(`/admin/products/${productId}`);
}

export async function movePreset(productId: string, presetId: string, direction: "up" | "down") {
  await requireAdmin();
  await reorder("preset", productId, presetId, direction);
  revalidatePath(`/admin/products/${productId}/presets`);
}

export async function deletePreset(productId: string, presetId: string) {
  await requireAdmin();
  const row = await db.preset.findUnique({ where: { id: presetId } });
  if (row) {
    await deleteFileByPublicUrl(row.fileUrl);
    await db.preset.delete({ where: { id: presetId } });
  }
  revalidatePath(`/admin/products/${productId}/presets`);
  revalidatePath(`/admin/products/${productId}`);
}
