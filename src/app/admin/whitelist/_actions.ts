"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { logAdmin } from "@/lib/audit";

const Input = z.object({
  productId: z.string().min(1).max(50),
  username:  z.string().min(1).max(100),
  isLifetime: z.boolean().optional(),
  /** Required when not lifetime. */
  durationDays: z.coerce.number().int().min(0).max(36500).optional(),
  label: z.string().max(200).optional().or(z.literal("")),
});

const UpdateInput = z.object({
  id:         z.string().min(1).max(50),
  username:   z.string().min(1).max(100),
  isLifetime: z.boolean(),
  /** ISO-ish datetime string from <input type="datetime-local">, or "" when lifetime. */
  expireDate: z.string().max(40).optional().or(z.literal("")),
  label:      z.string().max(200).optional().or(z.literal("")),
});

export async function createWhitelist(formData: FormData) {
  const session = await requireAdmin();
  const isLifetime = formData.get("isLifetime") === "on";
  const parsed = Input.safeParse({
    productId:    String(formData.get("productId") ?? ""),
    username:     String(formData.get("username")  ?? "").trim(),
    durationDays: formData.get("durationDays") ?? undefined,
    label:        formData.get("label") ?? "",
    isLifetime,
  });
  if (!parsed.success) throw new Error("Invalid input");
  const d = parsed.data;

  if (!isLifetime && !d.durationDays) {
    throw new Error("Please set duration days, or mark as lifetime.");
  }

  const expireDate = isLifetime
    ? null
    : new Date(Date.now() + (d.durationDays ?? 0) * 24 * 60 * 60 * 1000);

  // Idempotent on (productId, username) — upsert
  const row = await db.whitelist.upsert({
    where: { productId_username: { productId: d.productId, username: d.username } },
    update: {
      expireDate,
      isLifetime,
      label: d.label?.trim() || null,
      source: "MANUAL",
      addedBy: session.email,
    },
    create: {
      productId: d.productId,
      username:  d.username,
      expireDate,
      isLifetime,
      label: d.label?.trim() || null,
      source: "MANUAL",
      addedBy: session.email,
    },
  });
  await logAdmin({
    action: "whitelist.upsert",
    targetType: "whitelist",
    targetId: row.id,
    payload: {
      productId: d.productId,
      username:  d.username,
      isLifetime,
      expireDate: expireDate?.toISOString() ?? null,
    },
  });
  revalidatePath("/admin/whitelist");
}

/**
 * Edit an existing whitelist row. The admin can rename `username`, switch
 * between lifetime and timed, push the expiry date, or update the internal
 * `label`. Product and source aren't editable — moving a row to a different
 * product changes its identity, and changing source would whitewash the
 * Stripe-vs-manual provenance the audit log relies on.
 */
export async function updateWhitelist(formData: FormData): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const session = await requireAdmin();
  const isLifetime = formData.get("isLifetime") === "on";
  const parsed = UpdateInput.safeParse({
    id:         String(formData.get("id") ?? ""),
    username:   String(formData.get("username") ?? "").trim(),
    isLifetime,
    expireDate: String(formData.get("expireDate") ?? ""),
    label:      String(formData.get("label") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }
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
      source: true,
    },
  });
  if (!existing) {
    return { ok: false, error: "Whitelist entry not found" };
  }

  // ── Resolve the new expiry. ──────────────────────────────────────
  // Lifetime clears the date. Otherwise the datetime-local string maps
  // to a Date in the browser's local timezone, then we parse it server-
  // side. Bad/empty strings on a non-lifetime row are rejected so the
  // admin can't accidentally turn an active entry into a never-expiring
  // ghost without ticking Lifetime explicitly.
  let nextExpire: Date | null;
  if (d.isLifetime) {
    nextExpire = null;
  } else {
    if (!d.expireDate) {
      return {
        ok: false,
        error: "Please set an expire date, or mark this entry as Lifetime.",
      };
    }
    const parsedDate = new Date(d.expireDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return { ok: false, error: "Invalid date format" };
    }
    // Mirror createWhitelist's 100-year cap so the admin can't accidentally
    // create a non-lifetime "year 9999" entry that downstream analytics /
    // cleanup jobs aren't built to handle. If they truly want never-expires,
    // they should tick Lifetime explicitly.
    const maxAllowed = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
    if (parsedDate > maxAllowed) {
      return {
        ok: false,
        error: "Expire date is more than 100 years away. Tick Lifetime instead.",
      };
    }
    nextExpire = parsedDate;
  }

  // ── Username rename collision check. ─────────────────────────────
  // (productId, username) is unique. If the admin renames to a username
  // that already exists on the same product, reject loudly — silently
  // merging would risk overwriting an unrelated row's data.
  if (d.username !== existing.username) {
    const clash = await db.whitelist.findUnique({
      where: {
        productId_username: {
          productId: existing.productId,
          username: d.username,
        },
      },
      select: { id: true },
    });
    if (clash && clash.id !== existing.id) {
      return {
        ok: false,
        error: `Another whitelist entry already exists for "${d.username}" on this product.`,
      };
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
      editedBy: session.email,
    },
  });

  revalidatePath("/admin/whitelist");
  return { ok: true };
}

export async function deleteWhitelist(id: string) {
  await requireAdmin();
  const existing = await db.whitelist.findUnique({
    where: { id },
    select: { productId: true, username: true, isLifetime: true },
  });
  await db.whitelist.delete({ where: { id } });
  await logAdmin({
    action: "whitelist.delete",
    targetType: "whitelist",
    targetId: id,
    payload: existing ?? undefined,
  });
  revalidatePath("/admin/whitelist");
}
