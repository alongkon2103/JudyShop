"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-session";
import { updateSettings } from "@/lib/settings";
import { logAdmin } from "@/lib/audit";

// HTML checkboxes only POST `on` (or are omitted entirely) — coerce
// presence ⇒ true via z.preprocess so a missing key becomes `false`.
const checkboxBool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

const Input = z.object({
  cardFeePercent:   z.coerce.number().min(0).max(100),
  paypalFeePercent: z.coerce.number().min(0).max(100),
  promptpayEnabled: checkboxBool,
  cardEnabled:      checkboxBool,
  paypalEnabled:    checkboxBool,
});

export async function saveSettings(formData: FormData) {
  const session = await requireAdmin();
  const parsed = Input.safeParse({
    cardFeePercent:   formData.get("cardFeePercent")   ?? "0",
    paypalFeePercent: formData.get("paypalFeePercent") ?? "0",
    promptpayEnabled: formData.get("promptpayEnabled"),
    cardEnabled:      formData.get("cardEnabled"),
    paypalEnabled:    formData.get("paypalEnabled"),
  });
  if (!parsed.success) {
    throw new Error("Invalid value");
  }
  // Guardrail: at least one method must remain enabled, otherwise no
  // one can pay. Loud error instead of silent breakage.
  if (!parsed.data.promptpayEnabled && !parsed.data.cardEnabled && !parsed.data.paypalEnabled) {
    throw new Error("At least one payment method must be enabled.");
  }
  await updateSettings({
    cardFeePercent:   parsed.data.cardFeePercent,
    paypalFeePercent: parsed.data.paypalFeePercent,
    promptpayEnabled: parsed.data.promptpayEnabled,
    cardEnabled:      parsed.data.cardEnabled,
    paypalEnabled:    parsed.data.paypalEnabled,
    updatedBy: session.email,
  });
  await logAdmin({
    action: "settings.update",
    targetType: "settings",
    payload: {
      cardFeePercent:   parsed.data.cardFeePercent,
      paypalFeePercent: parsed.data.paypalFeePercent,
      promptpayEnabled: parsed.data.promptpayEnabled,
      cardEnabled:      parsed.data.cardEnabled,
      paypalEnabled:    parsed.data.paypalEnabled,
    },
  });
  revalidatePath("/admin/settings");
  // Public pricing/availability changes — bust the shop too.
  revalidatePath("/shop");
}
