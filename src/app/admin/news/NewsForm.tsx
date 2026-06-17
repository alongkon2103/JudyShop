"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { UploadCloud, X, Trash2, Loader2 } from "lucide-react";
import { Field, I18nField, inputClass } from "@/components/admin/Form";
import { Switch } from "@/components/admin/Switch";
import { useToast } from "@/components/admin/toast/ToastContext";
import { createNews, updateNews } from "./_actions";
import { toLocalInputValue } from "@/lib/datetime";
import {
  IMAGE_HELP_TEXT,
  IMAGE_TYPES,
  validateImage,
} from "@/lib/upload-constraints";
import { maybeShrinkImage, formatMB } from "@/lib/image-resize";
import { cn } from "@/lib/cn";

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Category = "UPDATE" | "ANNOUNCE" | "EVENT" | "MAINTENANCE";

export type NewsFormData = {
  id: string;
  titleEn: string;
  titleTh: string;
  excerptEn: string | null;
  excerptTh: string | null;
  imageUrl: string | null;
  category: Category;
  publishedAt: Date;
  isPublished: boolean;
};

type Props = { existing?: NewsFormData };

export function NewsForm({ existing }: Props) {
  const isEdit = !!existing;
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setRemoved(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const clearNewFile = () => {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const showImage =
    previewUrl ??
    (existing?.imageUrl && !removed ? existing.imageUrl : null);

  const action = async (formData: FormData) => {
    // Auto-shrink large covers before they hit the server action.
    const picked = formData.get("image");
    if (picked instanceof File && picked.size > 0) {
      const res = await maybeShrinkImage(picked);
      if (res.changed) {
        formData.set("image", res.file);
        toast.info(
          `ย่อขนาดอัตโนมัติ ${formatMB(res.originalBytes)} → ${formatMB(res.finalBytes)}`,
        );
      }
    }
    try {
      if (isEdit && existing) {
        await updateNews(existing.id, formData);
      } else {
        await createNews(formData);
        toast.success("News published");
        formRef.current?.reset();
        clearNewFile();
        setRemoved(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <I18nField
        label="Title"
        nameEn="titleEn"
        nameTh="titleTh"
        defaultValueEn={existing?.titleEn ?? ""}
        defaultValueTh={existing?.titleTh ?? ""}
        required
        maxLength={160}
      />

      <I18nField
        label="Excerpt (optional)"
        nameEn="excerptEn"
        nameTh="excerptTh"
        defaultValueEn={existing?.excerptEn ?? ""}
        defaultValueTh={existing?.excerptTh ?? ""}
        textarea
        maxLength={500}
        hint="คำอธิบายสั้นๆ ที่จะแสดงในการ์ดข่าว"
      />

      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-fg-light">Cover image (optional)</p>
        {showImage && (
          <div className="relative overflow-hidden rounded-lg border border-line-light bg-paper-2">
            <div className="grid place-items-center p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={showImage} alt="Preview" className="max-h-40 w-auto rounded-md object-contain" />
            </div>
            {previewUrl ? (
              <button
                type="button"
                onClick={clearNewFile}
                aria-label="Cancel new image"
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-paper text-fg-light-soft shadow-sm transition-colors hover:bg-pink-500 hover:text-white"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRemoved(true)}
                aria-label="Remove current image"
                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-paper px-2 py-1 text-[10px] font-semibold text-pink-500 shadow-sm transition-colors hover:bg-pink-500 hover:text-white"
              >
                <Trash2 size={11} strokeWidth={2.5} /> Remove
              </button>
            )}
          </div>
        )}

        {isEdit && removed && !file && (
          <input type="hidden" name="removeImage" value="on" />
        )}

        <div
          className={cn(
            "relative flex items-center gap-3 rounded-lg border-2 border-dashed border-line-light bg-paper-2 px-4 py-4",
            "transition-colors hover:border-pink-400 hover:bg-pink-500/5",
          )}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-pink-500/15 text-pink-500">
            <UploadCloud size={18} strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-fg-light">
              {file
                ? file.name
                : isEdit && existing?.imageUrl && !removed
                  ? "Replace image…"
                  : "Choose a cover image"}
            </p>
            <p className="text-[11px] text-fg-light-soft">
              {file ? formatSize(file.size) : IMAGE_HELP_TEXT}
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            name="image"
            accept={IMAGE_TYPES.accept}
            onChange={(e) => {
              const picked = e.target.files?.[0] ?? null;
              if (!picked) { setFile(null); return; }
              const check = validateImage(picked);
              if (!check.ok) {
                toast.error(check.error);
                e.target.value = "";
                setFile(null);
                return;
              }
              setFile(picked);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Category">
          <select
            name="category"
            defaultValue={existing?.category ?? "ANNOUNCE"}
            className={inputClass}
          >
            <option value="UPDATE">Update</option>
            <option value="ANNOUNCE">Announce</option>
            <option value="EVENT">Event</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </Field>
        <Field label="Published at" hint="Optional. Defaults to now.">
          <input
            type="datetime-local"
            name="publishedAt"
            defaultValue={toLocalInputValue(existing?.publishedAt)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Switch
          name="isPublished"
          defaultChecked={existing?.isPublished ?? true}
          label="Published"
          hint="Visible in /news"
        />
        <Submit isEdit={isEdit} />
      </div>
    </form>
  );
}

function Submit({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full bg-pink-500 px-6 py-2.5 text-[12px] font-semibold text-white shadow-[0_2px_0_var(--pink-600)] transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60"
    >
      {pending && <Loader2 size={13} className="animate-spin" />}
      {pending ? "กำลังอัพโหลด…" : isEdit ? "Save changes" : "Publish news"}
    </button>
  );
}
