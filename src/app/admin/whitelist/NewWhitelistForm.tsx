"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Field, inputClass } from "@/components/admin/Form";
import { Switch } from "@/components/admin/Switch";
import { useToast } from "@/components/admin/toast/ToastContext";

type Product = { id: string; slug: string; nameEn: string };

/**
 * Add-to-whitelist form. The `createAction` is injected so the same form
 * serves the admin surface (unrestricted) and the partner portal (a
 * partner-scoped action that rejects products the partner doesn't own).
 */
export function NewWhitelistForm({
  products,
  createAction,
}: {
  products: Product[];
  createAction: (formData: FormData) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [lifetime, setLifetime] = useState(false);
  const toast = useToast();

  const action = async (formData: FormData) => {
    try {
      await createAction(formData);
      toast.success("Whitelist entry added");
      formRef.current?.reset();
      setLifetime(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Product *">
          <select name="productId" required defaultValue="" className={inputClass}>
            <option value="" disabled>— pick a product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.nameEn}</option>
            ))}
          </select>
        </Field>
        <Field label="Roblox username *">
          <input name="username" type="text" required maxLength={100} className={inputClass} />
        </Field>
        <Field label="Duration (days)" hint={lifetime ? "Disabled — lifetime" : "Required"}>
          <input
            name="durationDays"
            type="number"
            min={1}
            max={36500}
            disabled={lifetime}
            placeholder="e.g. 30"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Label (optional)" hint='Internal note, e.g. "promo / refund / VIP"'>
        <input name="label" type="text" maxLength={200} className={inputClass} />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Switch
          name="isLifetime"
          checked={lifetime}
          onChange={setLifetime}
          label="Lifetime"
          hint="No expire date"
        />
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
      {pending ? "Adding…" : "Add to whitelist"}
    </button>
  );
}
