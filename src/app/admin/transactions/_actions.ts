"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { requireAdmin } from "@/lib/admin-session";
import { logAdmin } from "@/lib/audit";

/**
 * Discriminated error union — the UI uses `kind` to choose the right
 * tone (red toast for system-down, amber for "human needs to check
 * Stripe"). The `error` string is shown verbatim.
 */
export type RefundResult =
  | { ok: true }
  | {
      ok: false;
      kind:
        | "db_unreachable"
        | "not_found"
        | "already_refunded"
        | "not_paid"
        | "no_payment_intent"
        | "stripe_rejected"
        | "unknown";
      error: string;
    };

/**
 * Refund a paid order.
 *
 *   1. Verify the order exists + is currently PAID + has a Stripe
 *      payment_intent on file.
 *   2. Call Stripe Refund API. We pass `metadata` so the refund event
 *      ties back to our order in the dashboard.
 *   3. Flip the linked Whitelist row's source to REFUND_REVERT and
 *      shorten its `expireDate` to "now" so the customer immediately
 *      loses access in /api/checkwhitelist. A lifetime row gets its
 *      isLifetime cleared too.
 *   4. Mark Order.status = REFUNDED.
 *   5. Record an audit entry.
 *
 * Idempotent on retry: re-running on an already-REFUNDED order is a
 * no-op (early return).
 */
export async function refundOrder(args: {
  orderId: string;
  reason?: string;
}): Promise<RefundResult> {
  await requireAdmin();

  // ── 1. Load order (DB read) ──────────────────────────────────────
  let order;
  try {
    order = await db.order.findUnique({
      where: { id: args.orderId },
      include: { whitelist: true },
    });
  } catch (err) {
    return mapDbError(err, "loading the order");
  }

  if (!order) {
    return { ok: false, kind: "not_found", error: "Order not found." };
  }
  if (order.status === "REFUNDED") {
    return { ok: false, kind: "already_refunded", error: "Order is already refunded." };
  }
  if (order.status !== "PAID") {
    return {
      ok: false,
      kind: "not_paid",
      error: `Only PAID orders can be refunded (this one is ${order.status}).`,
    };
  }
  if (!order.stripePaymentId) {
    return {
      ok: false,
      kind: "no_payment_intent",
      error:
        "This order has no Stripe payment_intent on file — refund manually via the Stripe Dashboard, then mark the order REFUNDED here.",
    };
  }

  // ── 2. Stripe refund — fail fast before we touch our DB. ─────────
  try {
    await stripe.refunds.create({
      payment_intent: order.stripePaymentId,
      metadata: {
        orderId: order.id,
        reason: args.reason ?? "",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe refund failed.";
    return { ok: false, kind: "stripe_rejected", error: msg };
  }

  const now = new Date();

  // ── 3. DB write: revert whitelist + flip order status. ───────────
  try {
    await db.$transaction([
      ...(order.whitelist
        ? [
            db.whitelist.update({
              where: { id: order.whitelist.id },
              data: {
                source: "REFUND_REVERT",
                isLifetime: false,
                expireDate: now,
              },
            }),
          ]
        : []),
      db.order.update({
        where: { id: order.id },
        data: { status: "REFUNDED" },
      }),
    ]);
  } catch (err) {
    // The Stripe refund already went through. Surface this clearly so
    // an admin can manually flip the order to REFUNDED once DB is up.
    const dbErr = mapDbError(err, "saving the refund");
    return {
      ok: false,
      kind: dbErr.kind,
      error: `Stripe refunded successfully, BUT we couldn't update our DB (${dbErr.error}). Mark the order REFUNDED manually once the DB is reachable.`,
    };
  }

  // ── 4. Audit log — best-effort; don't roll back the refund on
  //      logging failure. ────────────────────────────────────────────
  try {
    await logAdmin({
      action: "order.refund",
      targetType: "order",
      targetId: order.id,
      payload: {
        amount: Number(order.amount),
        currency: order.currency,
        stripePaymentId: order.stripePaymentId,
        reason: args.reason ?? null,
        whitelistReverted: !!order.whitelist,
      },
    });
  } catch (err) {
    console.error("[refundOrder] audit log failed (refund itself succeeded):", err);
  }

  revalidatePath("/admin/transactions");
  revalidatePath("/admin/whitelist");
  return { ok: true };
}

/**
 * Translate a Prisma exception into a refund-flow error. P1001 is the
 * one we care most about (Supabase free-tier paused, network issue,
 * or wrong DATABASE_URL).
 */
function mapDbError(
  err: unknown,
  while_: string,
): Extract<RefundResult, { ok: false }> {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return {
      ok: false,
      kind: "db_unreachable",
      error: `Cannot reach the database while ${while_}. If Supabase is on free tier, the project may be paused — open the Supabase dashboard and restore it.`,
    };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P1001") {
    return {
      ok: false,
      kind: "db_unreachable",
      error: `Database unreachable (${err.code}) while ${while_}. Check that Supabase isn't paused and that DATABASE_URL is correct.`,
    };
  }
  const msg = err instanceof Error ? err.message : "Unknown DB error";
  return {
    ok: false,
    kind: "unknown",
    error: `Database error while ${while_}: ${msg}`,
  };
}
