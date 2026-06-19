"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Field, I18nField, inputClass } from "@/components/admin/Form";
import { Switch } from "@/components/admin/Switch";
import { useToast } from "@/components/admin/toast/ToastContext";
import { createHowToUseVideo, updateHowToUseVideo } from "./_actions";

type Initial = {
  id?: string;
  titleEn?: string;
  titleTh?: string;
  descriptionEn?: string | null;
  descriptionTh?: string | null;
  youtubeUrl?: string;
  displayOrder?: number;
  isActive?: boolean;
};

export function HowToUseForm({ initial }: { initial?: Initial }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!initial?.id;

  const action = async (formData: FormData) => {
    const res = isEdit
      ? await updateHowToUseVideo(formData)
      : await createHowToUseVideo(formData);
    if (res.ok) {
      toast.success(isEdit ? "Video updated" : "Video added");
      if (isEdit) {
        router.push("/admin/how-to-use");
      } else {
        formRef.current?.reset();
      }
    } else {
      toast.error(res.error);
    }
  };

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={initial!.id} />}

      <I18nField
        label="Title *"
        nameEn="titleEn"
        nameTh="titleTh"
        defaultValueEn={initial?.titleEn ?? ""}
        defaultValueTh={initial?.titleTh ?? ""}
        required
        maxLength={120}
      />

      <I18nField
        label="Description"
        nameEn="descriptionEn"
        nameTh="descriptionTh"
        defaultValueEn={initial?.descriptionEn ?? ""}
        defaultValueTh={initial?.descriptionTh ?? ""}
        textarea
        maxLength={2000}
        hint="Optional — shown under the video player."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field
          label="YouTube URL *"
          hint="วาง URL จาก YouTube (watch / youtu.be / shorts ใช้ได้หมด)"
        >
          <input
            name="youtubeUrl"
            type="url"
            required
            maxLength={500}
            defaultValue={initial?.youtubeUrl ?? ""}
            placeholder="https://www.youtube.com/watch?v=..."
            className={inputClass}
          />
        </Field>

        <Field label="Display order" hint="น้อย = ขึ้นก่อน">
          <input
            name="displayOrder"
            type="number"
            min={0}
            max={99999}
            defaultValue={initial?.displayOrder ?? 0}
            className={inputClass}
          />
        </Field>

        <Field label="Status">
          <div className="pt-1">
            <Switch
              name="isActive"
              defaultChecked={initial?.isActive ?? true}
              label="Active"
              hint="Visible on /how-to-use"
            />
          </div>
        </Field>
      </div>

      <div className="flex justify-end">
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
      className="rounded-full bg-pink-500 px-6 py-2.5 text-[12px] font-semibold text-white shadow-[0_2px_0_var(--pink-600)] transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60"
    >
      {pending ? "Saving…" : isEdit ? "Save changes" : "Add video"}
    </button>
  );
}
