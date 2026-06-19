"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast/ToastContext";
import { forceLogoutAdmin } from "./_actions";

type Props = {
  id: string;
  email: string;
};

/**
 * Bumps the target admin's tokenVersion — kicks them out of every
 * active session. Cannot target the current user (they should use the
 * normal Logout button instead).
 */
export function ForceLogoutButton({ id, email }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await forceLogoutAdmin(id);
      if (res.ok) {
        toast.success(`Logged ${email} out of every session`);
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
        title="Force logout"
        aria-label={`Force logout ${email}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line-light text-fg-light-soft transition-colors hover:border-pink-500/40 hover:bg-pink-500/10 hover:text-pink-400"
      >
        <LogOut size={13} strokeWidth={2.25} />
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        onConfirm={handleConfirm}
        title={`Force logout ${email}?`}
        description="Admin คนนี้จะถูก logout ทุก device / browser ทันที — ใช้เวลามือถือหายหรือสงสัยว่าโดน phish"
        confirmLabel="Force logout"
        variant="danger"
        pending={pending}
      />
    </>
  );
}
