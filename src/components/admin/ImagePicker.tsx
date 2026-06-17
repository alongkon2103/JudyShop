"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, X, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "./toast/ToastContext";
import {
  IMAGE_HELP_TEXT,
  IMAGE_TYPES,
  validateImage,
} from "@/lib/upload-constraints";
import { cn } from "@/lib/cn";

type Props = {
  /** Name attribute of the hidden <input type="file"> that the parent
   *  form should reach via formData.get(name). Required. */
  name: string;
  /** Existing image URL (edit mode). Shown as a preview with a
   *  "remove" button. */
  existingUrl?: string | null;
  /** Form-field name for the "remove the existing image" checkbox.
   *  Default is `removeImage`. */
  removeFieldName?: string;
  /** Optional caption — rendered above the picker. */
  label?: string;
  /** Whether the parent form is currently submitting. Drives the
   *  "uploading" overlay on the preview. */
  pending?: boolean;
  /** Optional `onChange` hook so the parent form knows when a new
   *  file was picked (for showing a custom indicator next to the
   *  Save button, etc.). */
  onFileChange?: (file: File | null) => void;
};

/**
 * Drop-in image picker used across every admin upload form.
 *
 * Behaviour highlights:
 *   1. The `<input accept>` is tightened to JPG/PNG/WebP/GIF only —
 *      Windows file dialogs won't even surface HEIC / TIFF / SVG.
 *   2. As soon as the user picks a file we run `validateImage()` so
 *      bad types / oversized files surface as a red toast immediately
 *      instead of after a long server-side upload that silently hangs
 *      at the network layer.
 *   3. A persistent preview shows the file name + size so the user
 *      knows what's actually going to be uploaded.
 *   4. When `pending` is true (parent form submitting) we overlay the
 *      preview with a spinner + "Uploading…" so they don't poke the
 *      save button twice.
 */
export function ImagePicker({
  name,
  existingUrl,
  removeFieldName = "removeImage",
  label,
  pending = false,
  onFileChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const [picked, setPicked] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  // Build / tear down the local object URL when a file is picked.
  useEffect(() => {
    if (!picked) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(picked);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [picked]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setPicked(null);
      onFileChange?.(null);
      return;
    }
    const check = validateImage(file);
    if (!check.ok) {
      toast.error(check.error);
      // Drop the bad file so the form doesn't try to submit it.
      e.target.value = "";
      setPicked(null);
      onFileChange?.(null);
      return;
    }
    setPicked(file);
    setRemoved(false);
    onFileChange?.(file);
  };

  const clearPick = () => {
    if (inputRef.current) inputRef.current.value = "";
    setPicked(null);
    onFileChange?.(null);
  };

  const markRemoved = () => setRemoved(true);
  const undoRemove  = () => setRemoved(false);

  const showExistingPreview = !!existingUrl && !picked && !removed;
  const showNewPreview      = !!picked;

  return (
    <div className="space-y-2">
      {label && (
        <span className="block font-sans text-[12px] font-extrabold uppercase tracking-[0.12em] text-fg-light-soft">
          {label}
        </span>
      )}

      {/* Existing image (edit mode) */}
      {showExistingPreview && (
        <div className="relative inline-flex max-w-full overflow-hidden rounded-md border border-line-light">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={existingUrl!}
            alt="Current"
            className="block h-32 w-auto object-contain"
          />
          <button
            type="button"
            onClick={markRemoved}
            disabled={pending}
            className="absolute right-1 top-1 inline-flex items-center gap-1 rounded-full bg-paper/90 px-2 py-1 text-[10.5px] font-semibold text-fg-light shadow-sm hover:bg-pink-500 hover:text-white disabled:opacity-60"
          >
            <X size={11} strokeWidth={2.5} /> Remove
          </button>
        </div>
      )}

      {/* "Will be removed" notice */}
      {existingUrl && removed && !picked && (
        <div className="inline-flex items-center gap-2 rounded-md border border-pink-500/40 bg-pink-500/5 px-3 py-2 text-[12px] text-pink-500">
          <span>รูปเดิมจะถูกลบหลังบันทึก</span>
          <button
            type="button"
            onClick={undoRemove}
            disabled={pending}
            className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-fg-light hover:bg-paper-2 disabled:opacity-60"
          >
            ยกเลิก
          </button>
        </div>
      )}

      {/* Newly picked image preview */}
      {showNewPreview && (
        <div className="relative inline-flex max-w-full flex-col gap-1 overflow-hidden rounded-md border border-line-light bg-paper-2 p-2">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl!}
              alt="Preview"
              className={cn(
                "block h-32 w-auto rounded object-contain",
                pending && "opacity-50",
              )}
            />
            {pending && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 rounded bg-paper/60 backdrop-blur-[1px]">
                <Loader2 size={16} className="animate-spin text-pink-500" />
                <span className="text-[11px] font-semibold text-fg-light">
                  Uploading…
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-fg-light-soft">
            {!pending && (
              <CheckCircle2 size={11} strokeWidth={2.5} className="text-[hsl(150_55%_45%)]" />
            )}
            <span className="truncate font-mono">{picked!.name}</span>
            <span className="ml-auto whitespace-nowrap tabular-nums">
              {(picked!.size / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
          {!pending && (
            <button
              type="button"
              onClick={clearPick}
              className="self-start text-[11px] font-semibold text-fg-light-mute hover:text-pink-500"
            >
              เลือกไฟล์ใหม่
            </button>
          )}
        </div>
      )}

      {/* The actual <input>. Always present (even when previews are
          shown) so the form always submits the value. */}
      <label
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-line-light bg-paper-2 px-3 py-3 transition-colors hover:border-pink-400 hover:bg-paper",
          pending && "pointer-events-none opacity-60",
        )}
      >
        <ImageIcon size={16} strokeWidth={2.25} className="text-fg-light-mute" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-fg-light">
            {showNewPreview ? "เปลี่ยนไฟล์" : "เลือกไฟล์ภาพ"}
          </p>
          <p className="text-[10.5px] text-fg-light-mute">{IMAGE_HELP_TEXT}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={IMAGE_TYPES.accept}
          onChange={handleChange}
          disabled={pending}
          className="sr-only"
        />
      </label>

      {/* Hidden input that the server action reads to know it should
          delete the existing image. We render it only when the admin
          actually pressed "Remove" on the existing image. */}
      {existingUrl && removed && !picked && (
        <input type="hidden" name={removeFieldName} value="on" />
      )}
    </div>
  );
}
