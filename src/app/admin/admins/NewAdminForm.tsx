"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Field, inputClass } from "@/components/admin/Form";
import { useToast } from "@/components/admin/toast/ToastContext";
import { createAdmin } from "./_actions";

export function NewAdminForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  const action = async (formData: FormData) => {
    const res = await createAdmin(formData);
    if (res.ok) {
      toast.success("Admin created");
      formRef.current?.reset();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Email *">
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="off"
            placeholder="new@admin.com"
            className={inputClass}
          />
        </Field>
        <Field label="Name">
          <input
            name="name"
            type="text"
            maxLength={100}
            placeholder="(optional)"
            className={inputClass}
          />
        </Field>
        <Field label="Password *" hint="อย่างน้อย 12 ตัว">
          <input
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
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
      {pending ? "Adding…" : "Add admin"}
    </button>
  );
}
