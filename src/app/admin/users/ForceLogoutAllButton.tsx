"use client";

import { useState, useTransition } from "react";
import { ShieldAlert } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast/ToastContext";
import { forceLogoutAllAdmins } from "./_actions";

/**
 * Danger-zone button — kicks every admin (including you) out of every
 * session. Use during incident response when you're unsure which
 * credentials might be compromised.
 */
export function ForceLogoutAllButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await forceLogoutAllAdmins();
      if (res.ok) {
        toast.success("ทุก admin ถูก logout — รวมถึงตัวคุณ");
        setOpen(false);
        // Next request will hit requireAdmin() and redirect to /login.
        window.location.href = "/admin/login";
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
        className="inline-flex items-center gap-1.5 rounded-full border border-pink-500/30 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-pink-400 transition-colors hover:border-pink-500/60 hover:bg-pink-500/10"
      >
        <ShieldAlert size={12} strokeWidth={2.5} />
        Force logout all
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        onConfirm={handleConfirm}
        title="Force logout every admin?"
        description="Admin ทุกคน (รวมตัวคุณ) จะถูก logout ทุก session ทันที. ใช้เฉพาะตอนสงสัยว่ามีการ compromise."
        confirmLabel="Logout everyone"
        variant="danger"
        pending={pending}
      />
    </>
  );
}
