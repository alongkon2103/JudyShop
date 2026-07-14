"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createProductAction, type ProductFormState } from "../_actions";
import {
  Field,
  FormSection,
  I18nField,
  inputClass,
} from "@/components/admin/Form";
import { Switch } from "@/components/admin/Switch";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { AdminButton } from "@/components/admin/Button";

export function NewProductForm() {
  const [state, formAction] = useFormState<ProductFormState | null, FormData>(
    createProductAction,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-s5">
      <FormSection title="Basic info" subtitle="Slug, badges and visibility.">
        <div className="grid grid-cols-1 gap-s3 sm:grid-cols-2">
          <Field
            label="Slug"
            hint="URL key. Leave blank to derive from English name."
            error={errors.slug}
          >
            <input
              name="slug"
              type="text"
              maxLength={60}
              pattern="[a-z0-9-]*"
              placeholder="judy-legend"
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
              maxLength={120}
              placeholder="https://www.roblox.com/games/12345678/… หรือ 12345678"
              className={inputClass}
            />
          </Field>

          <Field label="Badge">
            <select name="badge" defaultValue="" className={inputClass}>
              <option value="">— none —</option>
              <option value="HOT">HOT</option>
              <option value="NEW">NEW</option>
              <option value="SALE">SALE</option>
            </select>
          </Field>

          <Field label="Display order" hint="Smaller value = appears first.">
            <input
              name="displayOrder"
              type="number"
              min={0}
              max={99999}
              defaultValue={0}
              className={inputClass}
            />
          </Field>

          <Field label="Status" full>
            <div className="flex flex-wrap items-center gap-s4 pt-1">
              <Switch name="isActive" defaultChecked label="Active" hint="Visible in shop" />
              <Switch name="comingSoon" label="Coming soon" hint="Disable purchase" />
            </div>
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Partner / affiliate link"
        subtitle="ถ้าเป็นเกมของร้านพาร์ทเนอร์ (ขายผ่านร้านอื่น) วางลิงก์ที่เขาให้มาเต็มๆ รวม ?ref= — การ์ดจะพาลูกค้าออกไปหน้าร้านนั้นแทนการเปิดหน้าจ่ายเงินในเว็บ (ไม่ต้องใส่ Plan)"
      >
        <Field
          label="External URL"
          error={errors.externalUrl}
          hint="เว้นว่างไว้ถ้าเป็นเกมของคุณเองที่ขายในเว็บ"
          full
        >
          <input
            name="externalUrl"
            type="url"
            maxLength={500}
            placeholder="https://aclassstore.com/products/ac-jump-evo?ref=JUDY-STUDIO"
            className={inputClass}
          />
        </Field>
      </FormSection>

      <FormSection title="Display name" subtitle="ตัวอักษรที่ลูกค้าเห็น (กรอกทั้ง EN และ TH).">
        <I18nField
          label="Name"
          nameEn="nameEn"
          nameTh="nameTh"
          required
          maxLength={120}
          errorEn={errors.nameEn}
          errorTh={errors.nameTh}
        />
        <I18nField
          label="Short name"
          nameEn="shortNameEn"
          nameTh="shortNameTh"
          maxLength={60}
          hint="Optional — for tight UI spots."
        />
      </FormSection>

      <FormSection
        title="Description"
        subtitle="คำอธิบายสำหรับ Product Modal และการ์ดสินค้า — bold / list / heading ได้, สีและฟอนต์ระบบเป็นคนกำหนด"
      >
        <div className="grid grid-cols-1 gap-s4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="font-sans text-[12px] font-extrabold uppercase tracking-[0.12em] text-fg-light">
              Description (EN)
            </label>
            <RichTextEditor
              name="descriptionEn"
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
          maxLength={180}
          hint="Optional one-liner shown on cards. Plain text."
        />
      </FormSection>

      {state && !state.ok && (
        <p className="rounded-md border border-pink-500/40 bg-pink-500/10 px-3 py-2 text-[12px] font-bold text-pink-500">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-s2">
        <AdminButton href="/admin/products" variant="outline">
          Cancel
        </AdminButton>
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
      {pending ? "Creating…" : "Create product"}
    </button>
  );
}
