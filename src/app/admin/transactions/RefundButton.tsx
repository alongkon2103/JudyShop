"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Undo2 } from "lucide-react";
import { Portal } from "@/components/admin/Portal";
import { useToast } from "@/components/admin/toast/ToastContext";
import { refundOrder } from "./_actions";
import { cn } from "@/lib/cn";

type Props = {
  orderId: string;
  amount: string;
  username: string;
  stripePaymentId: string;
  paymentMethod: "Card" | "PromptPay";
  productName: string;
  planLabel: string;
};

/**
 * Refund button + confirmation modal.
 *
 * Two-click on purpose — refunds move real money. The modal shows
 * exactly what'll happen (Stripe charge reversed, whitelist revoked),
 * surfaces enough Stripe context for the admin to double-check
 * against the Stripe dashboard, and lets them attach an optional
 * reason for the audit log.
 *
 * UX details:
 *   - ESC closes the modal (unless a refund is mid-flight).
 *   - Backdrop click closes too, but only when idle.
 *   - Initial focus goes to the Cancel button so a stray Enter does
 *     NOT immediately fire a refund.
 *   - Pending state disables both buttons and the textarea.
 */
export function RefundButton({
  orderId,
  amount,
  username,
  stripePaymentId,
  paymentMethod,
  productName,
  planLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Move focus to Cancel on open + listen for ESC. The Cancel-first
  // focus order matters: a casually-pressed Enter shouldn't trigger
  // an irreversible action.
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    // Lock background scroll while the dialog is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, pending]);

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await refundOrder({
        orderId,
        reason: reason.trim() || undefined,
      });
      if (res.ok) {
        toast.success(
          "Refund issued",
          "Stripe refunded · whitelist revoked · order marked REFUNDED",
        );
        setOpen(false);
        setReason("");
      } else {
        // Tailor the second-line message to the failure kind so admins
        // know whether to retry, check Stripe, or fix infra.
        const subtitle = subtitleFor(res.kind);
        toast.error(res.error, subtitle);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-line-light px-3 py-1.5 font-sans text-[11px] font-extrabold uppercase tracking-[0.08em] text-pink-400",
          "transition-colors hover:border-pink-500/40 hover:bg-pink-500/10",
        )}
      >
        <Undo2 size={12} strokeWidth={2.5} />
        Refund
      </button>

      {open && (
        // Portal escapes AdminShell's transformed <main> so the
        // backdrop and panel are positioned against the viewport.
        <Portal>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-modal-title"
          className="fixed inset-0 z-[60] overflow-y-auto"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close"
            onClick={() => !pending && setOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-[3px]"
          />

          <div className="relative flex min-h-full items-end justify-center p-3 sm:items-center sm:p-4">
          <div
            className={cn(
              "anim-spring w-full max-w-lg overflow-hidden rounded-2xl",
              "bg-paper text-fg-light shadow-2xl ring-1 ring-line-light",
            )}
          >
            {/* ── Header — icon stacked above so title aligns with
                  the body content's left edge. ────────────────────── */}
            <div className="border-b border-line-light bg-paper-2/60 p-s4 text-left sm:p-s5">
              <span
                aria-hidden
                className="mb-s3 grid h-10 w-10 place-items-center rounded-full bg-pink-500/15 text-pink-400"
              >
                <AlertTriangle size={20} strokeWidth={2.25} />
              </span>
              <h3
                id="refund-modal-title"
                className="font-display text-[20px] uppercase tracking-wide text-fg-light"
              >
                Refund this order?
              </h3>
              <p className="mt-1 text-[12px] text-fg-light-soft">
                คืนเงินผ่าน Stripe และตัดสิทธิ์ Whitelist ทันที — ทำกลับไม่ได้
              </p>
            </div>

            {/* ── Body ──────────────────────────────────────────── */}
            <div className="space-y-s4 p-s4 text-left sm:p-s5">
              {/* Order summary — left-aligned label / left-aligned value
                  with the parent <dd> handling truncation for long IDs. */}
              <dl className="space-y-1.5 rounded-lg border border-line-light bg-paper-2/50 p-s3">
                <Row label="Product">
                  {productName}
                  <span className="text-fg-light-soft"> · {planLabel}</span>
                </Row>
                <Row label="Username">
                  <span className="font-mono">{username}</span>
                </Row>
                <Row label="Amount">
                  <span className="font-semibold text-pink-400">{amount}</span>
                  <span className="text-fg-light-soft"> · {paymentMethod}</span>
                </Row>
                <Row label="Payment ID">
                  <span className="font-mono text-[11px] text-fg-light-mute" title={stripePaymentId}>
                    {stripePaymentId}
                  </span>
                </Row>
                <Row label="Order ID">
                  <span className="font-mono text-[11px] text-fg-light-mute" title={orderId}>
                    {orderId}
                  </span>
                </Row>
              </dl>

              {/* What will happen — bulleted for scannability */}
              <div className="rounded-lg border border-pink-500/30 bg-pink-500/8 p-s3 text-[12px] leading-relaxed text-fg-light">
                <p className="mb-1.5 font-bold uppercase tracking-[0.08em] text-pink-400">
                  เกิดอะไรขึ้นเมื่อกด Confirm
                </p>
                <ul className="list-disc space-y-0.5 pl-4 text-fg-light-soft">
                  <li>
                    Stripe คืนเงินไป {paymentMethod} ของลูกค้า{" "}
                    <span className="text-fg-light-mute">(รับเงิน 1–10 วันทำการ)</span>
                  </li>
                  <li>
                    Whitelist ของ <span className="font-mono text-fg-light">{username}</span>{" "}
                    ถูกตัดทันที (เข้าเกมไม่ได้)
                  </li>
                  <li>Order เปลี่ยนสถานะเป็น REFUNDED + เขียน Audit log</li>
                </ul>
              </div>

              {/* Reason — encourage but don't force */}
              <label className="block">
                <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-fg-light-soft">
                  เหตุผล (optional · เก็บใน Audit log)
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  rows={2}
                  disabled={pending}
                  placeholder="เช่น ลูกค้าจ่ายผิด username, ขอคืนเอง, สินค้าใช้ไม่ได้"
                  className="mt-1 w-full rounded-md border border-line-light bg-paper-2 px-3 py-2 text-[13px] text-fg-light placeholder:text-fg-light-mute focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 disabled:opacity-60"
                />
                <span className="mt-1 block text-left text-[10px] text-fg-light-mute">
                  {reason.length}/500
                </span>
              </label>
            </div>

            {/* ── Footer ────────────────────────────────────────── */}
            <div className="flex items-center justify-end gap-2 border-t border-line-light bg-paper-2/60 px-s4 py-3 sm:px-s5">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-full border border-line-light px-4 py-2 text-[12px] font-semibold text-fg-light-soft hover:bg-paper hover:text-fg-light disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full bg-pink-500 px-5 py-2 text-[12px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_2px_0_var(--pink-600)] transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {pending ? "Refunding…" : (
                  <>
                    <Undo2 size={12} strokeWidth={2.5} />
                    Confirm refund
                  </>
                )}
              </button>
            </div>
          </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}

/**
 * Label/value row. Label sits in a fixed-width column on the left,
 * value reads left-to-right immediately after it — same scan path
 * for every row. Long IDs truncate at the right edge of the value
 * cell, not the modal edge, so they never overflow the card.
 */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-[88px] shrink-0 text-left font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-fg-light-mute">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 truncate text-left text-[12px] text-fg-light">
        {children}
      </dd>
    </div>
  );
}

/**
 * Toast subtitle keyed off the discriminated error. Different
 * problems need different next steps — e.g. a DB outage is "wait
 * and retry", a Stripe rejection is "check the dashboard".
 */
function subtitleFor(kind: string): string {
  switch (kind) {
    case "db_unreachable":
      return "Supabase project อาจถูกพักไว้ (free tier) — เปิด dashboard แล้วลองใหม่";
    case "no_payment_intent":
      return "Webhook ไม่ได้บันทึก payment_intent — refund ผ่าน Stripe Dashboard ตรง ๆ";
    case "stripe_rejected":
      return "Stripe ปฏิเสธคำขอ — ตรวจ Payment Intent ใน Stripe Dashboard";
    case "not_paid":
      return "Order นี้ยังไม่ paid — refund ไม่ได้";
    case "already_refunded":
      return "Refund ถูกทำไปแล้วก่อนหน้า";
    default:
      return "ลองอีกครั้ง หรือเช็ค server logs";
  }
}
