"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updateProductAction, type ProductFormState } from "../../_actions";
import {
  Field,
  FormSection,
  I18nField,
  inputClass,
} from "@/components/admin/Form";
import { Switch } from "@/components/admin/Switch";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { useToast } from "@/components/admin/toast/ToastContext";

type Props = {
  product: {
    id: string;
    slug: string;
    nameEn: string;
    nameTh: string;
    shortNameEn: string | null;
    shortNameTh: string | null;
    descriptionEn: string;
    descriptionTh: string;
    shortDescriptionEn: string | null;
    shortDescriptionTh: string | null;
    badge: "HOT" | "NEW" | "SALE" | null;
    gameId: string | null;
    isActive: boolean;
    comingSoon: boolean;
    trialEnabled: boolean;
    trialMinutes: number;
    displayOrder: number;
  };
};

export function EditDetailsForm({ product }: Props) {
  const bound = updateProductAction.bind(null, product.id);
  const [state, formAction] = useFormState<ProductFormState | null, FormData>(bound, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const toast = useToast();

  // Fire a toast only when *this* server-action result is new — by tracking
  // the state object identity. useFormState returns the same reference until
  // the action returns again, so this fires exactly once per submission.
  const lastHandled = useRef<ProductFormState | null>(null);
  useEffect(() => {
    if (!state || lastHandled.current === state) return;
    lastHandled.current = state;
    if (state.ok) {
      toast.success("Product updated", "Saved ✓");
    } else {
      toast.error(state.error ?? "Validation failed", "Could not save");
    }
  }, [state, toast]);

  return (
    <form action={formAction} className="space-y-s5">
      <FormSection title="Basic info" subtitle="Slug, badges and visibility.">
        <div className="grid grid-cols-1 gap-s3 sm:grid-cols-2">
          <Field label="Slug" error={errors.slug} hint="URL key.">
            <input
              name="slug"
              type="text"
              defaultValue={product.slug}
              maxLength={60}
              pattern="[a-z0-9-]*"
              className={inputClass}
            />
          </Field>

          <Field
            label="Game ID"
            hint="วาง URL หน้าเกมจาก Roblox ได้เลย (เช่น https://www.roblox.com/games/12345678/My-Game) ระบบจะดึงเฉพาะเลขออกมาให้"
          >
            <input
              name="gameId"
              type="text"
              defaultValue={product.gameId ?? ""}
              maxLength={120}
              placeholder="https://www.roblox.com/games/12345678/… หรือ 12345678"
              className={inputClass}
            />
          </Field>

          <Field label="Badge">
            <select name="badge" defaultValue={product.badge ?? ""} className={inputClass}>
              <option value="">— none —</option>
              <option value="HOT">HOT</option>
              <option value="NEW">NEW</option>
              <option value="SALE">SALE</option>
            </select>
          </Field>

          <Field label="Display order" hint="Smaller = first.">
            <input
              name="displayOrder"
              type="number"
              min={0}
              max={99999}
              defaultValue={product.displayOrder}
              className={inputClass}
            />
          </Field>

          <Field label="Status" full>
            <div className="flex flex-wrap items-center gap-s4 pt-1">
              <Switch
                name="isActive"
                defaultChecked={product.isActive}
                label="Active"
                hint="Visible in shop"
              />
              <Switch
                name="comingSoon"
                defaultChecked={product.comingSoon}
                label="Coming soon"
                hint="Disable purchase"
              />
            </div>
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Trial mode"
        subtitle="ให้ผู้เข้าชมกดทดลองใช้สั้นๆ ก่อนซื้อ — จำกัด 1 ครั้ง / username / 24 ชั่วโมง"
      >
        <div className="grid grid-cols-1 gap-s3 sm:grid-cols-2">
          <Field label="Enable trial" full>
            <div className="pt-1">
              <Switch
                name="trialEnabled"
                defaultChecked={product.trialEnabled}
                label="ทดลองใช้"
                hint="แสดงปุ่ม 'ทดลองใช้ X นาที' ใต้ปุ่มซื้อ"
              />
            </div>
          </Field>
          <Field
            label="Trial minutes"
            error={errors.trialMinutes}
            hint="1–60 นาที (ค่าเริ่มต้น 10)"
          >
            <input
              name="trialMinutes"
              type="number"
              min={1}
              max={60}
              defaultValue={product.trialMinutes}
              className={inputClass}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Display name">
        <I18nField
          label="Name"
          nameEn="nameEn"
          nameTh="nameTh"
          defaultValueEn={product.nameEn}
          defaultValueTh={product.nameTh}
          required
          maxLength={120}
          errorEn={errors.nameEn}
          errorTh={errors.nameTh}
        />
        <I18nField
          label="Short name"
          nameEn="shortNameEn"
          nameTh="shortNameTh"
          defaultValueEn={product.shortNameEn ?? ""}
          defaultValueTh={product.shortNameTh ?? ""}
          maxLength={60}
          hint="Optional — for tight UI spots."
        />
      </FormSection>

      <FormSection
        title="Description"
        subtitle="ใช้ bold / list / heading ได้ — สีและฟอนต์ระบบเป็นคนกำหนด"
      >
        <div className="grid grid-cols-1 gap-s4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="font-sans text-[12px] font-extrabold uppercase tracking-[0.12em] text-fg-light">
              Description (EN)
            </label>
            <RichTextEditor
              name="descriptionEn"
              defaultValue={product.descriptionEn}
              placeholder="Tell customers what this game is about…"
              maxLength={2000}
            />
            {errors.descriptionEn && (
              <p className="text-[11px] font-bold text-pink-500">{errors.descriptionEn}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="font-sans text-[12px] font-extrabold uppercase tracking-[0.12em] text-fg-light">
              Description (TH)
            </label>
            <RichTextEditor
              name="descriptionTh"
              defaultValue={product.descriptionTh}
              placeholder="อธิบายว่าเกมนี้ทำอะไร / ใครเหมาะจะใช้…"
              maxLength={2000}
            />
            {errors.descriptionTh && (
              <p className="text-[11px] font-bold text-pink-500">{errors.descriptionTh}</p>
            )}
          </div>
        </div>

        <I18nField
          label="Short description"
          nameEn="shortDescriptionEn"
          nameTh="shortDescriptionTh"
          defaultValueEn={product.shortDescriptionEn ?? ""}
          defaultValueTh={product.shortDescriptionTh ?? ""}
          maxLength={180}
          hint="Optional — one-liner on cards. Plain text."
        />
      </FormSection>

      <div className="flex items-center justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-pink-500 px-7 py-3 font-sans text-[13px] font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_3px_0_var(--pink-600)] transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}
