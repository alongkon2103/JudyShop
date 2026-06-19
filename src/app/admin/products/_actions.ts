"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { logAdmin } from "@/lib/audit";
import { sanitizeRichText, stripRichText } from "@/lib/sanitize";
import { parseGameId } from "./_helpers";

// ── Helpers ───────────────────────────────────────────────────

const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

const opt = (s: string | null | undefined) => (s && s.trim().length ? s.trim() : null);

const BadgeSchema = z.enum(["HOT", "NEW", "SALE"]).optional().or(z.literal(""));

// ── Schemas ───────────────────────────────────────────────────

const ProductInput = z.object({
  nameEn: z.string().min(1).max(120),
  nameTh: z.string().min(1).max(120),
  slug: z.string().max(60).optional().or(z.literal("")),
  shortNameEn: z.string().max(60).optional().or(z.literal("")),
  shortNameTh: z.string().max(60).optional().or(z.literal("")),
  // descriptions are TipTap HTML — bump byte cap to 5000 (plain-text
  // content still capped to 2000 chars in the editor itself).
  descriptionEn: z.string().min(1).max(5000),
  descriptionTh: z.string().min(1).max(5000),
  shortDescriptionEn: z.string().max(180).optional().or(z.literal("")),
  shortDescriptionTh: z.string().max(180).optional().or(z.literal("")),
  badge: BadgeSchema,
  gameId: z.string().max(200).optional().or(z.literal("")),
  // Game link (Roblox game URL) and preset link shown on the success
  // page. Both validated as URLs when provided, falling back to ""
  // so the admin can clear them.
  gameLinkUrl:   z.string().max(500).url().optional().or(z.literal("")),
  gamePresetUrl: z.string().max(500).url().optional().or(z.literal("")),
  isActive: z.union([z.literal("on"), z.literal("")]).optional(),
  comingSoon: z.union([z.literal("on"), z.literal("")]).optional(),
  trialEnabled: z.union([z.literal("on"), z.literal("")]).optional(),
  trialMinutes: z.coerce.number().int().min(1).max(60).default(10),
  displayOrder: z.coerce.number().int().min(0).max(99999).default(0),
});

export type ProductFormState =
  | { ok: true; productId?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function collectFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = issue.path[0];
    if (typeof k === "string" && !out[k]) out[k] = issue.message;
  }
  return out;
}

// ── Create ────────────────────────────────────────────────────

export async function createProductAction(
  _prev: ProductFormState | null,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const parsed = ProductInput.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: collectFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  // Sanitize rich-text descriptions BEFORE we trust them anywhere —
  // strips <script>, inline styles, etc. See src/lib/sanitize.ts.
  const descriptionEn = sanitizeRichText(data.descriptionEn);
  const descriptionTh = sanitizeRichText(data.descriptionTh);
  if (!stripRichText(descriptionEn) || !stripRichText(descriptionTh)) {
    return {
      ok: false,
      error: "Description required",
      fieldErrors: {
        ...(!stripRichText(descriptionEn) && { descriptionEn: "Required" }),
        ...(!stripRichText(descriptionTh) && { descriptionTh: "Required" }),
      },
    };
  }

  const slug = (data.slug && data.slug.length ? data.slug : slugify(data.nameEn || data.nameTh)).trim();
  if (!slug) return { ok: false, error: "Could not derive slug from name." };

  const exists = await db.product.findUnique({ where: { slug } });
  if (exists) return { ok: false, error: `Slug "${slug}" already exists.` };

  const product = await db.product.create({
    data: {
      slug,
      nameEn: data.nameEn,
      nameTh: data.nameTh,
      shortNameEn: opt(data.shortNameEn),
      shortNameTh: opt(data.shortNameTh),
      descriptionEn,
      descriptionTh,
      shortDescriptionEn: opt(data.shortDescriptionEn),
      shortDescriptionTh: opt(data.shortDescriptionTh),
      badge: data.badge ? data.badge : null,
      gameId: parseGameId(data.gameId),
      gameLinkUrl:   opt(data.gameLinkUrl),
      gamePresetUrl: opt(data.gamePresetUrl),
      isActive: data.isActive === "on",
      comingSoon: data.comingSoon === "on",
      trialEnabled: data.trialEnabled === "on",
      trialMinutes: data.trialMinutes,
      displayOrder: data.displayOrder,
    },
  });

  await logAdmin({
    action: "product.create",
    targetType: "product",
    targetId: product.id,
    payload: { slug, nameEn: data.nameEn },
  });

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  redirect(`/admin/products/${product.id}`);
}

// ── Update (Details tab) ──────────────────────────────────────

export async function updateProductAction(
  id: string,
  _prev: ProductFormState | null,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const parsed = ProductInput.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: collectFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const slug = (data.slug && data.slug.length ? data.slug : slugify(data.nameEn || data.nameTh)).trim();
  if (!slug) return { ok: false, error: "Could not derive slug from name." };

  const conflict = await db.product.findFirst({
    where: { slug, NOT: { id } },
    select: { id: true },
  });
  if (conflict) return { ok: false, error: `Slug "${slug}" already taken.` };

  const descriptionEn = sanitizeRichText(data.descriptionEn);
  const descriptionTh = sanitizeRichText(data.descriptionTh);
  if (!stripRichText(descriptionEn) || !stripRichText(descriptionTh)) {
    return {
      ok: false,
      error: "Description required",
      fieldErrors: {
        ...(!stripRichText(descriptionEn) && { descriptionEn: "Required" }),
        ...(!stripRichText(descriptionTh) && { descriptionTh: "Required" }),
      },
    };
  }

  await db.product.update({
    where: { id },
    data: {
      slug,
      nameEn: data.nameEn,
      nameTh: data.nameTh,
      shortNameEn: opt(data.shortNameEn),
      shortNameTh: opt(data.shortNameTh),
      descriptionEn,
      descriptionTh,
      shortDescriptionEn: opt(data.shortDescriptionEn),
      shortDescriptionTh: opt(data.shortDescriptionTh),
      badge: data.badge ? data.badge : null,
      gameId: parseGameId(data.gameId),
      gameLinkUrl:   opt(data.gameLinkUrl),
      gamePresetUrl: opt(data.gamePresetUrl),
      isActive: data.isActive === "on",
      comingSoon: data.comingSoon === "on",
      trialEnabled: data.trialEnabled === "on",
      trialMinutes: data.trialMinutes,
      displayOrder: data.displayOrder,
    },
  });

  await logAdmin({
    action: "product.update",
    targetType: "product",
    targetId: id,
    payload: { slug, nameEn: data.nameEn, isActive: data.isActive === "on" },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/shop");
  return { ok: true, productId: id };
}

// ── Delete ────────────────────────────────────────────────────

/** Direct call signature — used by the client DeleteButton. */
export async function deleteProductById(id: string) {
  await requireAdmin();
  const existing = await db.product.findUnique({
    where: { id },
    select: { slug: true, nameEn: true },
  });
  await db.product.delete({ where: { id } });
  await logAdmin({
    action: "product.delete",
    targetType: "product",
    targetId: id,
    payload: existing ?? undefined,
  });
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}

/** FormData signature — kept for any non-JS form fallbacks. */
export async function deleteProductAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  await deleteProductById(id);
}
