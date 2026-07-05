"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Plus, Minus, RotateCcw, Trash2 } from "lucide-react";
import { Switch } from "@/components/admin/Switch";
import { Portal } from "@/components/admin/Portal";
import { useToast } from "@/components/admin/toast/ToastContext";
import { toLocalInputValue } from "@/lib/datetime";
import { cn } from "@/lib/cn";

type Props = {
  id: string;
  username: string;
  productName: string;
  source: string;
  isLifetime: boolean;
  expireDate: string | null;
  label: string | null;
  /** Injected so admin + partner reuse this modal with their own scoped
   *  server actions. `updateAction` returns a result; `deleteAction`
   *  throws on failure (matching the underlying server actions). */
  updateAction: (fd: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;
  deleteAction: (id: string) => Promise<void>;
};

const QUICK_EXTENDS = [
  { days: 1,   label: "+1d" },
  { days: 7,   label: "+7d" },
  { days: 30,  label: "+30d" },
  { days: 90,  label: "+90d" },
  { days: 365, label: "+1y" },
];

/**
 * Inline edit modal for a single whitelist row. Lets the admin:
 *   - Rename `username`
 *   - Tick / untick Lifetime (clears or restores the expire date)
 *   - Push the expire date forward via quick `+Nd` buttons that add to
 *     whichever value is currently in the picker; for already-expired
 *     rows there's a "Set to now" reset so quick extends start from
 *     today instead of compounding ancient dates.
 *   - Update the internal admin label
 *
 * Modeled after RefundButton: Cancel-first focus, ESC to close, backdrop
 * click closes, pending state disables everything.
 */
export function EditWhitelistButton({
  id,
  username,
  productName,
  source,
  isLifetime: initialLifetime,
  expireDate: initialExpireIso,
  label: initialLabel,
  updateAction,
  deleteAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const toast = useToast();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Form state — re-initialised on open so reopening after a previous
  // edit picks up the latest server values.
  const [name, setName] = useState(username);
  const [lifetime, setLifetime] = useState(initialLifetime);
  const [expireLocal, setExpireLocal] = useState(
    initialExpireIso ? toLocalInputValue(new Date(initialExpireIso)) : "",
  );
  const [label, setLabel] = useState(initialLabel ?? "");
  // Custom-step number, stored as the raw input string so the user can
  // type freely (incl. an empty box while editing). Coerced to int on use.
  const [customStep, setCustomStep] = useState("5");

  useEffect(() => {
    if (!open) return;
    setName(username);
    setLifetime(initialLifetime);
    setExpireLocal(initialExpireIso ? toLocalInputValue(new Date(initialExpireIso)) : "");
    setLabel(initialLabel ?? "");
    setConfirmRemove(false);
    setCustomStep("5");
    cancelRef.current?.focus();
    // Lock page scroll while the modal is open so background content
    // doesn't move under the user's interaction with the dialog.
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
  }, [open, username, initialLifetime, initialExpireIso, initialLabel, pending]);

  // Extends start from whatever date is in the picker. If the picker is
  // empty (lifetime → off, or expireDate was null), we pin the baseline
  // to "now" so the first +7d means seven days from today.
  const extendBy = (days: number) => {
    const base = expireLocal ? new Date(expireLocal) : new Date();
    if (Number.isNaN(base.getTime())) return;
    const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    setExpireLocal(toLocalInputValue(next));
  };

  const resetToNow = () => setExpireLocal(toLocalInputValue(new Date()));

  // Apply ±customStep to whichever date is in the picker. Same baseline
  // rule as extendBy: empty picker → "now" so the offset is meaningful.
  const applyCustom = (sign: 1 | -1) => {
    const n = Math.abs(parseInt(customStep, 10));
    if (!Number.isFinite(n) || n <= 0) return;
    extendBy(sign * n);
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteAction(id);
        toast.success(`Removed ${username}`);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to remove");
      }
    });
  };

  const handleSave = () => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("username", name.trim());
    fd.set("label", label);
    fd.set("expireDate", lifetime ? "" : expireLocal);
    if (lifetime) fd.set("isLifetime", "on");

    startTransition(async () => {
      const res = await updateAction(fd);
      if (res.ok) {
        toast.success("Whitelist updated");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Edit"
        aria-label={`Edit ${username}`}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full",
          "border border-line-light text-fg-light-soft",
          "transition-colors hover:bg-paper-2 hover:text-fg-light",
        )}
      >
        <Pencil size={13} strokeWidth={2.25} />
      </button>

      {open && (
        // Portal teleports the dialog to <body>, escaping AdminShell's
        // transformed <main> so `position: fixed` is anchored to the
        // viewport instead of the page container.
        <Portal>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`edit-wl-${id}-title`}
          className="fixed inset-0 z-[60] overflow-y-auto"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close"
            onClick={() => !pending && setOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-[3px]"
          />

          {/* Inner flex wrapper grows to min-h-full so the panel is
              vertically centred when it fits, and scrolls from the
              top edge when taller than the viewport. */}
          <div className="relative flex min-h-full items-end justify-center p-3 sm:items-center sm:p-4">
          <div
            className={cn(
              "anim-spring w-full max-w-lg overflow-hidden rounded-2xl",
              "bg-paper text-fg-light shadow-2xl ring-1 ring-line-light",
            )}
          >
            {/* Header */}
            <div className="border-b border-line-light bg-paper-2/60 p-s4 text-left sm:p-s5">
              <span
                aria-hidden
                className="mb-s3 grid h-10 w-10 place-items-center rounded-full bg-pink-500/15 text-pink-400"
              >
                <Pencil size={18} strokeWidth={2.25} />
              </span>
              <h3
                id={`edit-wl-${id}-title`}
                className="font-display text-[20px] uppercase tracking-wide text-fg-light"
              >
                Edit whitelist entry
              </h3>
              <p className="mt-1 text-[12px] text-fg-light-soft">
                <span className="font-mono">{productName}</span>
                {" · "}
                <span className="uppercase tracking-[0.06em] text-fg-light-mute">{source}</span>
              </p>
            </div>

            {/* Body */}
            <div className="space-y-s4 p-s4 text-left sm:p-s5">
              {/* Username */}
              <label className="block">
                <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-fg-light-soft">
                  Roblox username
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={pending}
                  maxLength={100}
                  className="mt-1 w-full rounded-md border border-line-light bg-paper-2 px-3 py-2 text-[13px] font-mono text-fg-light focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 disabled:opacity-60"
                />
              </label>

              {/* Lifetime toggle */}
              <div className="rounded-lg border border-line-light bg-paper-2/50 p-s3">
                <Switch
                  name="isLifetimeUI"
                  checked={lifetime}
                  onChange={setLifetime}
                  disabled={pending}
                  label="Lifetime access"
                  hint="เปิด = ใช้งานได้ตลอด · ปิด = มีวันหมดอายุ"
                />
              </div>

              {/* Expire date — disabled when lifetime */}
              <label className={cn("block", lifetime && "opacity-50")}>
                <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-fg-light-soft">
                  Expires at
                </span>
                <input
                  type="datetime-local"
                  value={expireLocal}
                  onChange={(e) => setExpireLocal(e.target.value)}
                  disabled={pending || lifetime}
                  className="mt-1 w-full rounded-md border border-line-light bg-paper-2 px-3 py-2 text-[13px] text-fg-light focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 disabled:cursor-not-allowed"
                />
              </label>

              {/* Quick adjust — two clean rows, no loud colours.
                    Row 1: utility "Now" + 5 preset extend chips (soft pink).
                    Row 2: a single stepper for any custom value, with ± to
                           apply either direction. Subtracting odd amounts
                           (refund 3 days, etc.) goes here — no need for a
                           full mirror row of minus presets cluttering the
                           panel. */}
              {!lifetime && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={resetToNow}
                      disabled={pending}
                      title="Reset expiry to right now"
                      className="inline-flex items-center gap-1 rounded-full border border-line-light bg-paper-2 px-3 py-1.5 text-[11px] font-semibold text-fg-light-soft hover:bg-paper hover:text-fg-light disabled:opacity-60"
                    >
                      <RotateCcw size={11} strokeWidth={2.25} />
                      Now
                    </button>
                    {QUICK_EXTENDS.map((q) => (
                      <button
                        key={q.days}
                        type="button"
                        onClick={() => extendBy(q.days)}
                        disabled={pending}
                        className="inline-flex items-center gap-0.5 rounded-full border border-pink-500/30 bg-pink-500/[0.06] px-3 py-1.5 text-[11px] font-semibold text-pink-400/90 hover:border-pink-500/50 hover:bg-pink-500/[0.12] disabled:opacity-60"
                      >
                        <Plus size={10} strokeWidth={2.5} />
                        {q.label.replace("+", "")}
                      </button>
                    ))}
                  </div>

                  {/* Custom stepper — one compact pill: [−] [ N ] days [+]. */}
                  <div className="inline-flex items-center gap-1 rounded-full border border-line-light bg-paper-2 p-1">
                    <button
                      type="button"
                      onClick={() => applyCustom(-1)}
                      disabled={pending}
                      aria-label="Subtract custom days"
                      className="grid h-7 w-7 place-items-center rounded-full text-fg-light-soft hover:bg-paper hover:text-fg-light disabled:opacity-60"
                    >
                      <Minus size={12} strokeWidth={2.5} />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={9999}
                      value={customStep}
                      onChange={(e) => setCustomStep(e.target.value)}
                      disabled={pending}
                      placeholder="5"
                      aria-label="Custom days"
                      className="w-12 bg-transparent text-center text-[12px] font-semibold text-fg-light focus:outline-none disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="px-1 text-[11px] font-semibold text-fg-light-mute">days</span>
                    <button
                      type="button"
                      onClick={() => applyCustom(1)}
                      disabled={pending}
                      aria-label="Add custom days"
                      className="grid h-7 w-7 place-items-center rounded-full text-pink-400 hover:bg-pink-500/15 disabled:opacity-60"
                    >
                      <Plus size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              )}

              {/* Label */}
              <label className="block">
                <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-fg-light-soft">
                  Label <span className="font-normal lowercase text-fg-light-mute">(optional · admin note)</span>
                </span>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={pending}
                  maxLength={200}
                  placeholder='เช่น "promo", "refund", "VIP"'
                  className="mt-1 w-full rounded-md border border-line-light bg-paper-2 px-3 py-2 text-[13px] text-fg-light placeholder:text-fg-light-mute focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 disabled:opacity-60"
                />
              </label>
            </div>

            {/* Footer — inline confirm replaces the normal buttons when the
                admin clicks Remove, so we don't stack a second modal on top
                of this one. */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-light bg-paper-2/60 px-s4 py-3 sm:px-s5">
              {confirmRemove ? (
                <>
                  <p className="min-w-0 flex-1 text-[12px] text-fg-light-soft">
                    Remove <span className="font-mono font-semibold text-fg-light">{username}</span>?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      disabled={pending}
                      className="rounded-full border border-line-light px-4 py-2 text-[12px] font-semibold text-fg-light-soft hover:bg-paper hover:text-fg-light disabled:opacity-60"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(0_75%_55%)] px-5 py-2 text-[12px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_2px_0_hsl(0_75%_38%)] transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                      <Trash2 size={13} strokeWidth={2.5} />
                      {pending ? "Removing…" : "Confirm remove"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(true)}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(0_75%_55%/0.4)] bg-[hsl(0_75%_55%/0.06)] px-4 py-2 text-[12px] font-semibold text-[hsl(0_75%_55%)] hover:bg-[hsl(0_75%_55%/0.14)] disabled:opacity-60"
                  >
                    <Trash2 size={13} strokeWidth={2.25} />
                    Remove
                  </button>
                  <div className="flex items-center gap-2">
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
                      onClick={handleSave}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-full bg-pink-500 px-5 py-2 text-[12px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_2px_0_var(--pink-600)] transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                      {pending ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
