"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { logAdmin } from "@/lib/audit";
import { extractYouTubeId } from "@/lib/youtube";

const Input = z.object({
  titleEn:       z.string().min(1).max(120),
  titleTh:       z.string().min(1).max(120),
  descriptionEn: z.string().max(2000).optional().or(z.literal("")),
  descriptionTh: z.string().max(2000).optional().or(z.literal("")),
  youtubeUrl:    z.string().min(1).max(500),
  displayOrder:  z.coerce.number().int().min(0).max(99999).default(0),
  isActive:      z.union([z.literal("on"), z.literal("")]).optional(),
});

const UpdateInput = Input.extend({
  id: z.string().min(1).max(50),
});

export type HowToUseResult =
  | { ok: true }
  | { ok: false; error: string };

function parseFormData(formData: FormData) {
  return {
    titleEn:       String(formData.get("titleEn") ?? "").trim(),
    titleTh:       String(formData.get("titleTh") ?? "").trim(),
    descriptionEn: String(formData.get("descriptionEn") ?? "").trim(),
    descriptionTh: String(formData.get("descriptionTh") ?? "").trim(),
    youtubeUrl:    String(formData.get("youtubeUrl") ?? "").trim(),
    displayOrder:  String(formData.get("displayOrder") ?? "0"),
    isActive:      formData.get("isActive") === "on" ? "on" as const : "" as const,
  };
}

export async function createHowToUseVideo(formData: FormData): Promise<HowToUseResult> {
  const session = await requireAdmin();
  const parsed = Input.safeParse(parseFormData(formData));
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const videoId = extractYouTubeId(parsed.data.youtubeUrl);
  if (!videoId) return { ok: false, error: "ลิงก์ YouTube ไม่ถูกต้อง" };

  const created = await db.howToUseVideo.create({
    data: {
      titleEn:       parsed.data.titleEn,
      titleTh:       parsed.data.titleTh,
      descriptionEn: parsed.data.descriptionEn || null,
      descriptionTh: parsed.data.descriptionTh || null,
      youtubeUrl:    parsed.data.youtubeUrl,
      videoId,
      displayOrder:  parsed.data.displayOrder,
      isActive:      parsed.data.isActive === "on",
    },
  });

  await logAdmin({
    action:     "how_to_use.create",
    targetType: "how_to_use",
    targetId:   created.id,
    payload: {
      titleEn:   parsed.data.titleEn,
      videoId,
      createdBy: session.email,
    },
  });

  revalidatePath("/admin/how-to-use");
  revalidatePath("/how-to-use");
  revalidatePath("/en/how-to-use");
  revalidatePath("/th/how-to-use");
  return { ok: true };
}

export async function updateHowToUseVideo(formData: FormData): Promise<HowToUseResult> {
  const session = await requireAdmin();
  const parsed = UpdateInput.safeParse({
    id: String(formData.get("id") ?? ""),
    ...parseFormData(formData),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const videoId = extractYouTubeId(parsed.data.youtubeUrl);
  if (!videoId) return { ok: false, error: "ลิงก์ YouTube ไม่ถูกต้อง" };

  const before = await db.howToUseVideo.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { ok: false, error: "Video not found" };

  await db.howToUseVideo.update({
    where: { id: parsed.data.id },
    data: {
      titleEn:       parsed.data.titleEn,
      titleTh:       parsed.data.titleTh,
      descriptionEn: parsed.data.descriptionEn || null,
      descriptionTh: parsed.data.descriptionTh || null,
      youtubeUrl:    parsed.data.youtubeUrl,
      videoId,
      displayOrder:  parsed.data.displayOrder,
      isActive:      parsed.data.isActive === "on",
    },
  });

  await logAdmin({
    action:     "how_to_use.update",
    targetType: "how_to_use",
    targetId:   parsed.data.id,
    payload: { titleEn: parsed.data.titleEn, editedBy: session.email },
  });

  revalidatePath("/admin/how-to-use");
  revalidatePath("/how-to-use");
  revalidatePath("/en/how-to-use");
  revalidatePath("/th/how-to-use");
  return { ok: true };
}

export async function deleteHowToUseVideo(id: string): Promise<HowToUseResult> {
  const session = await requireAdmin();
  const before = await db.howToUseVideo.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Video not found" };

  await db.howToUseVideo.delete({ where: { id } });

  await logAdmin({
    action:     "how_to_use.delete",
    targetType: "how_to_use",
    targetId:   id,
    payload: { titleEn: before.titleEn, deletedBy: session.email },
  });

  revalidatePath("/admin/how-to-use");
  revalidatePath("/how-to-use");
  revalidatePath("/en/how-to-use");
  revalidatePath("/th/how-to-use");
  return { ok: true };
}
