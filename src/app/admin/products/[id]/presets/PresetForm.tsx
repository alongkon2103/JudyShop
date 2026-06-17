"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { UploadCloud } from "lucide-react";
import { Switch } from "@/components/admin/Switch";
import { Field, inputClass } from "@/components/admin/Form";
import { useToast } from "@/components/admin/toast/ToastContext";
import { createPreset } from "../_actions";
import { cn } from "@/lib/cn";

export function PresetForm({ productId }: { productId: string }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const programRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const action = async (formData: FormData) => {
    try {
      await createPreset(productId, formData);
      toast.success("Preset uploaded");
      if (fileRef.current) fileRef.current.value = "";
      if (nameRef.current) nameRef.current.value = "";
      if (programRef.current) programRef.current.value = "";
      setFileName(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <form action={action} className="space-y-3">
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-lg border-2 border-dashed border-line-light bg-paper-2 px-4 py-5",
          "transition-colors hover:border-pink-400 hover:bg-pink-500/5",
        )}
      >
        <span className="grid h-10 w-10 place-items-center rounded-md bg-pink-500/15 text-pink-500">
          <UploadCloud size={18} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-fg-light">
            {fileName ?? "Choose a preset file"}
          </p>
          <p className="text-[11px] text-fg-light-soft">Any binary, up to 50 MB</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          name="file"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name (optional)" hint="เว้นว่างได้ — จะใช้ชื่อไฟล์">
          <input
            ref={nameRef}
            name="name"
            type="text"
            maxLength={80}
            placeholder="Judy Legend Preset"
            className={inputClass}
          />
        </Field>
        <Field label="Target program (optional)">
          <input
            ref={programRef}
            name="targetProgram"
            type="text"
            maxLength={60}
            placeholder="Tikfinity"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Switch name="isActive" defaultChecked label="Active" />
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
      {pending ? "Uploading…" : "Upload preset"}
    </button>
  );
}
