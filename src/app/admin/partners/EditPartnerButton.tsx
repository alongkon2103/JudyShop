"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Portal } from "@/components/admin/Portal";
import { useToast } from "@/components/admin/toast/ToastContext";
import { cn } from "@/lib/cn";
import { updatePartner } from "./_actions";

type Props = {
  id: string;
  name: string;
  contact: string | null;
  note: string | null;
};

/**
 * Inline edit modal for a single partner row. Same Portal + ESC +
 * Cancel-first-focus pattern as the whitelist editor — kept in sync
 * intentionally so the admin UI feels consistent.
 */
export function EditPartnerButton({ id, name, contact, note }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const [nameInput, setNameInput] = useState(name);
  const [contactInput, setContactInput] = useState(contact ?? "");
  const [noteInput, setNoteInput] = useState(note ?? "");

  useEffect(() => {
    if (!open) return;
    setNameInput(name);
    setContactInput(contact ?? "");
    setNoteInput(note ?? "");
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
  }, [open, name, contact, note, pending]);

  const handleSave = () => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("name", nameInput.trim());
    fd.set("contact", contactInput);
    fd.set("note", noteInput);
    startTransition(async () => {
      const res = await updatePartner(fd);
      if (res.ok) {
        toast.success("Partner updated");
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
        aria-label={`Edit ${name}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line-light text-fg-light-soft transition-colors hover:bg-paper-2 hover:text-fg-light"
      >
        <Pencil size={13} strokeWidth={2.25} />
      </button>

      {open && (
        <Portal>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-partner-${id}-title`}
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
                  <h3 id={`edit-partner-${id}-title`} className="font-display text-[20px] uppercase tracking-wide text-fg-light">
                    Edit Partner
                  </h3>
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
                      className="mt-1 w-full rounded-md border border-line-light bg-paper-2 px-3 py-2 text-[13px] text-fg-light focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 disabled:opacity-60"
                    />
                  </label>

                  <label className="block">
                    <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-fg-light-soft">
                      Contact <span className="font-normal lowercase text-fg-light-mute">(email / phone / line)</span>
                    </span>
                    <input
                      type="text"
                      value={contactInput}
                      onChange={(e) => setContactInput(e.target.value)}
                      disabled={pending}
                      maxLength={200}
                      className="mt-1 w-full rounded-md border border-line-light bg-paper-2 px-3 py-2 text-[13px] text-fg-light focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 disabled:opacity-60"
                    />
                  </label>

                  <label className="block">
                    <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-fg-light-soft">
                      Internal note <span className="font-normal lowercase text-fg-light-mute">(admin only)</span>
                    </span>
                    <textarea
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      disabled={pending}
                      maxLength={500}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-line-light bg-paper-2 px-3 py-2 text-[13px] text-fg-light focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 disabled:opacity-60"
                    />
                  </label>
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
