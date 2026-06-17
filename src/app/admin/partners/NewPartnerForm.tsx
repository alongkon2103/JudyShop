"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Field, inputClass } from "@/components/admin/Form";
import { useToast } from "@/components/admin/toast/ToastContext";
import { createPartner } from "./_actions";

/**
 * Compact "add partner" form pinned to the top of the partners list.
 * Three fields — name (required), contact (optional, free-form), and
 * an internal admin note. Submitting clears the form so admins can
 * batch-add partners without re-focusing.
 */
export function NewPartnerForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  const action = async (formData: FormData) => {
    const res = await createPartner(formData);
    if (res.ok) {
      toast.success("Partner added");
      formRef.current?.reset();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Name *">
          <input
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="เช่น คุณ A"
            className={inputClass}
          />
        </Field>
        <Field label="Contact" hint="Email / phone / LINE id">
          <input
            name="contact"
            type="text"
            maxLength={200}
            placeholder="a@email.com"
            className={inputClass}
          />
        </Field>
        <Field label="Internal note" hint="ไม่แสดงให้ Partner เห็น">
          <input
            name="note"
            type="text"
            maxLength={500}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Submit />
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-pink-500 px-6 py-2.5 text-[12px] font-semibold text-white shadow-[0_2px_0_var(--pink-600)] transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60"
    >
      {pending ? "Adding…" : "Add partner"}
    </button>
  );
}
