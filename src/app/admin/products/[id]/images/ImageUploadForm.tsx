"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { UploadCloud, X, Loader2 } from "lucide-react";
import { Switch } from "@/components/admin/Switch";
import { useToast } from "@/components/admin/toast/ToastContext";
import { createImage } from "../_actions";
import {
  IMAGE_HELP_TEXT,
  IMAGE_TYPES,
  validateImage,
} from "@/lib/upload-constraints";
import { maybeShrinkImage, formatMB } from "@/lib/image-resize";
import { cn } from "@/lib/cn";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageUploadForm({ productId }: { productId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Build/cleanup blob URL whenever the picked file changes.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const clearFile = () => {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const action = async (formData: FormData) => {
    // Auto-shrink product photos before upload — JPEG is fine here.
    const picked = formData.get("file");
    if (picked instanceof File && picked.size > 0) {
      const res = await maybeShrinkImage(picked);
      if (res.changed) {
        formData.set("file", res.file);
        toast.info(
          `ย่อขนาดอัตโนมัติ ${formatMB(res.originalBytes)} → ${formatMB(res.finalBytes)}`,
        );
      }
    }
    try {
      await createImage(productId, formData);
      toast.success("Image uploaded");
      clearFile();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <form action={action} className="space-y-3">
      {/* Preview (only when a file is picked) */}
      {previewUrl && (
        <div className="relative overflow-hidden rounded-lg border border-line-light bg-paper-2">
          <div className="grid place-items-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-48 w-auto rounded-md object-contain"
            />
          </div>
          <button
            type="button"
            onClick={clearFile}
            aria-label="Remove file"
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-paper text-fg-light-soft shadow-sm transition-colors hover:bg-pink-500 hover:text-white"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
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
            {file ? file.name : "Choose an image"}
          </p>
          <p className="text-[11px] text-fg-light-soft">
            {file ? formatSize(file.size) : IMAGE_HELP_TEXT}
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept={IMAGE_TYPES.accept}
          required
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Switch name="isThumbnail" label="Set as thumbnail" />
        <Submit disabled={!file} />
      </div>
    </form>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex items-center gap-1.5 rounded-full bg-pink-500 px-6 py-2.5 text-[12px] font-semibold text-white shadow-[0_2px_0_var(--pink-600)] transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60"
    >
      {pending && <Loader2 size={13} className="animate-spin" />}
      {pending ? "กำลังอัพโหลด…" : "Upload image"}
    </button>
  );
}
