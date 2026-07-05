"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Portal } from "@/components/admin/Portal";
import { useToast } from "@/components/admin/toast/ToastContext";
import { cn } from "@/lib/cn";
import { updateAdmin } from "./_actions";

type Props = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  /** True when this row represents the currently logged-in admin —
   *  the active-state toggle is disabled to prevent self-lockout. */
  isSelf: boolean;
};

export function EditAdminButton({ id, email, name, isActive, isSelf }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const [nameInput, setNameInput] = useState(name ?? "");
  const [activeInput, setActiveInput] = useState(isActive);

  useEffect(() => {
    if (!open) return;
    setNameInput(name ?? "");
    setActiveInput(isActive);
    cancelRef.current?.focus();
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
  }, [open, name, isActive, pending]);

  const handleSave = () => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("name", nameInput.trim());
    fd.set("isActive", String(activeInput));
    startTransition(async () => {
      const res = await updateAdmin(fd);
      if (res.ok) {
        toast.success("Admin updated");
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
        aria-label={`Edit ${email}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line-light text-fg-light-soft transition-colors hover:bg-paper-2 hover:text-fg-light"
      >
        <Pencil size={13} strokeWidth={2.25} />
      </button>

      {open && (
        <Portal>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-admin-${id}-title`}
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
                <div className="border-b border-line-light bg-paper-2/60 p-s4 text-left sm:p-s5">
                  <span aria-hidden className="mb-s3 grid h-10 w-10 place-items-center rounded-full bg-pink-500/15 text-pink-400">
                    <Pencil size={18} strokeWidth={2.25} />
                  </span>
                  <h3 id={`edit-admin-${id}-title`} className="font-display text-[20px] uppercase tracking-wide text-fg-light">
                    Edit Admin
                  </h3>
                  <p className="mt-1 font-mono text-[12px] text-fg-light-soft">{email}</p>
                </div>

                <div className="space-y-s4 p-s4 text-left sm:p-s5">
                  <label className="block">
                    <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-fg-light-soft">
                      Name
                    </span>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      disabled={pending}
                      maxLength={100}
                      placeholder="(optional)"
                      className="mt-1 w-full rounded-md border border-line-light bg-paper-2 px-3 py-2 text-[13px] text-fg-light focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 disabled:opacity-60"
                    />
                  </label>

                  <div className="block">
                    <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-fg-light-soft">
                      Status
                    </span>
                    <label className={cn(
                      "mt-1 flex items-center gap-2 rounded-md border px-3 py-2",
                      isSelf ? "border-line-light bg-paper-2/40 opacity-60" : "border-line-light bg-paper-2",
                    )}>
                      <input
                        type="checkbox"
                        checked={activeInput}
                        onChange={(e) => setActiveInput(e.target.checked)}
                        disabled={pending || isSelf}
                        className="h-4 w-4 accent-pink-500"
                      />
                      <span className="text-[13px] text-fg-light">
                        Active — สามารถ login เข้า admin panel ได้
                      </span>
                    </label>
                    {isSelf && (
                      <p className="mt-1.5 text-[11px] text-fg-light-mute">
                        ปิดบัญชีตัวเองไม่ได้ — ให้ admin คนอื่นปิดให้
                      </p>
                    )}
                  </div>
                </div>

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
                    onClick={handleSave}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-full bg-pink-500 px-5 py-2 text-[12px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_2px_0_var(--pink-600)] transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {pending ? "Saving…" : "Save changes"}
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
