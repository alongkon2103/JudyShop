"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { useToast } from "@/components/admin/toast/ToastContext";
import { updateRules, type RulesResult } from "./_actions";

type Props = {
  initialEn: string;
  initialTh: string;
};

export function RulesForm({ initialEn, initialTh }: Props) {
  const [state, formAction] = useFormState<RulesResult | null, FormData>(
    async (_prev, formData) => updateRules(formData),
    null,
  );
  const toast = useToast();
  const lastHandled = useRef<RulesResult | null>(null);

  useEffect(() => {
    if (!state || lastHandled.current === state) return;
    lastHandled.current = state;
    if (state.ok) toast.success("Rules saved");
    else toast.error(state.error);
  }, [state, toast]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="font-sans text-[12px] font-extrabold uppercase tracking-[0.12em] text-fg-light">
            Rules (EN)
          </label>
          <RichTextEditor
            name="contentEn"
            defaultValue={initialEn}
            placeholder="Write the site rules in English…"
            maxLength={20000}
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-sans text-[12px] font-extrabold uppercase tracking-[0.12em] text-fg-light">
            Rules (TH)
          </label>
          <RichTextEditor
            name="contentTh"
            defaultValue={initialTh}
            placeholder="เขียนกฎของร้านเป็นภาษาไทย…"
            maxLength={20000}
          />
        </div>
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
      className="rounded-full bg-pink-500 px-7 py-3 font-sans text-[13px] font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_3px_0_var(--pink-600)] transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save rules"}
    </button>
  );
}
