"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-session";
import { updateSettings } from "@/lib/settings";
import { logAdmin } from "@/lib/audit";

const Input = z.object({
  cardFeePercent: z.coerce.number().min(0).max(100),
});

export async function saveSettings(formData: FormData) {
  const session = await requireAdmin();
  const parsed = Input.safeParse({
    cardFeePercent: formData.get("cardFeePercent") ?? "0",
  });
  if (!parsed.success) {
    throw new Error("Invalid value");
  }
  await updateSettings({
    cardFeePercent: parsed.data.cardFeePercent,
    updatedBy: session.email,
  });
  await logAdmin({
    action: "settings.update",
    targetType: "settings",
    payload: { cardFeePercent: parsed.data.cardFeePercent },
  });
  revalidatePath("/admin/settings");
  // Public pricing changes when card fee changes — bust the shop too.
  revalidatePath("/shop");
}
