"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Field, inputClass } from "@/components/admin/Form";
import { useToast } from "@/components/admin/toast/ToastContext";
import { createAdmin } from "./_actions";

type PartnerOption = { id: string; name: string };

export function NewAdminForm({ partners }: { partners: PartnerOption[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  // Controlled so the Partner picker can appear/disappear; native form
  // reset won't touch it, so we also reset it by hand on success.
  const [role, setRole] = useState<"ADMIN" | "PARTNER">("ADMIN");

  const action = async (formData: FormData) => {
    const res = await createAdmin(formData);
    if (res.ok) {
      toast.success("User created");
      formRef.current?.reset();
      setRole("ADMIN");
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
            placeholder="new@user.com"
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field
          label="Role *"
          hint={role === "ADMIN" ? "เห็นหลังบ้านทั้งหมด" : "เห็นเฉพาะเกม/ยอดของ Partner"}
        >
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as "ADMIN" | "PARTNER")}
            className={inputClass}
          >
            <option value="ADMIN">Admin</option>
            <option value="PARTNER">Partner</option>
          </select>
        </Field>

        {role === "PARTNER" && (
          <Field label="Partner *" hint="ผูกบัญชีนี้กับหุ้นส่วนคนไหน (เห็นเฉพาะเกมของหุ้นส่วนนี้)" full>
            {partners.length === 0 ? (
              <p className="rounded-md border border-line-light bg-paper-2/60 px-3 py-2.5 text-[12px] text-fg-light-mute">
                ยังไม่มี Partner — ไปสร้างที่หน้า Partners ก่อน แล้วค่อยกลับมาสร้างบัญชีนี้
              </p>
            ) : (
              <select name="partnerId" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  เลือก Partner…
                </option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
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
      {pending ? "Adding…" : "Add user"}
    </button>
  );
}
