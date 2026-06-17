"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { logAdmin } from "@/lib/audit";

export type SetSharesResult =
  | { ok: true }
  | { ok: false; error: string };

const RowSchema = z.object({
  partnerId:    z.string().min(1).max(50),
  sharePercent: z.coerce.number().min(0).max(100),
});
const Input = z.object({
  productId: z.string().min(1).max(50),
  rows:      z.array(RowSchema).max(20),
});

/**
 * Replace the entire ProductPartner set for a single product in one
 * shot. The client sends the desired array; the server validates the
 * invariants (no duplicate partners, sum ≤ 100, every share strictly
 * positive) and then swaps the rows inside a transaction so a reader
 * never sees a half-applied allocation.
 *
 * Zero rows is valid — it means "no partners, the shared pool gets
 * 100% of revenue". Each non-zero row must have sharePercent > 0;
 * a 0% allocation is meaningless and we reject it to keep the table
 * honest (use Remove instead).
 */
export async function setProductPartners(payload: {
  productId: string;
  rows: { partnerId: string; sharePercent: number | string }[];
}): Promise<SetSharesResult> {
  const session = await requireAdmin();
  const parsed = Input.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }
  const { productId, rows } = parsed.data;

  // ── Invariants ────────────────────────────────────────────────────
  const seen = new Set<string>();
  let sum = 0;
  for (const r of rows) {
    if (seen.has(r.partnerId)) {
      return { ok: false, error: "Partner ซ้ำในรายการ — เลือก Partner แต่ละคนได้ครั้งเดียว" };
    }
    seen.add(r.partnerId);
    if (r.sharePercent <= 0) {
      return { ok: false, error: "Share % ต้องมากกว่า 0 — ถ้าไม่อยากให้ปันส่วนให้ลบ row นี้ออก" };
    }
    sum += r.sharePercent;
  }
  // Allow a tiny float tolerance for sums like 33.33 × 3 = 99.99.
  if (sum > 100.0001) {
    return { ok: false, error: `Share % รวมเกิน 100 (${sum.toFixed(2)}%) ลดลงให้ ≤ 100 ก่อนบันทึก` };
  }

  // Verify product + all partners exist (avoid foreign-key surprises).
  const [product, partners] = await Promise.all([
    db.product.findUnique({ where: { id: productId }, select: { id: true, nameEn: true } }),
    rows.length > 0
      ? db.partner.findMany({
          where: { id: { in: rows.map((r) => r.partnerId) } },
          select: { id: true },
        })
      : Promise.resolve([] as { id: string }[]),
  ]);
  if (!product) return { ok: false, error: "Product not found" };
  if (partners.length !== rows.length) {
    return { ok: false, error: "Partner บางคนถูกลบไปแล้ว — รีเฟรชหน้านี้แล้วลองอีกครั้ง" };
  }

  // Snapshot the existing rows for the audit log diff.
  const before = await db.productPartner.findMany({
    where: { productId },
    select: { partnerId: true, sharePercent: true },
  });

  await db.$transaction([
    db.productPartner.deleteMany({ where: { productId } }),
    ...(rows.length > 0
      ? [
          db.productPartner.createMany({
            data: rows.map((r) => ({
              productId,
              partnerId: r.partnerId,
              sharePercent: r.sharePercent,
            })),
          }),
        ]
      : []),
  ]);

  await logAdmin({
    action: "product.partners.update",
    targetType: "product",
    targetId: productId,
    payload: {
      before: before.map((b) => ({ partnerId: b.partnerId, sharePercent: Number(b.sharePercent) })),
      after:  rows.map((r) => ({ partnerId: r.partnerId, sharePercent: r.sharePercent })),
      sumAfter: sum,
      editedBy: session.email,
    },
  });

  revalidatePath(`/admin/products/${productId}/partners`);
  return { ok: true };
}
