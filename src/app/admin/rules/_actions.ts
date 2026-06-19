"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { logAdmin } from "@/lib/audit";
import { sanitizeRichText } from "@/lib/sanitize";

const Input = z.object({
  contentEn: z.string().max(20000),
  contentTh: z.string().max(20000),
});

export type RulesResult =
  | { ok: true }
  | { ok: false; error: string };

const SETTINGS_ID = "singleton";

export async function updateRules(formData: FormData): Promise<RulesResult> {
  const session = await requireAdmin();
  const parsed = Input.safeParse({
    contentEn: String(formData.get("contentEn") ?? ""),
    contentTh: String(formData.get("contentTh") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  // Same sanitisation pipeline as product descriptions — strips
  // <script>, inline styles, and anything outside the safe tag set.
  const rulesContentEn = sanitizeRichText(parsed.data.contentEn);
  const rulesContentTh = sanitizeRichText(parsed.data.contentTh);

  await db.setting.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      rulesContentEn,
      rulesContentTh,
      updatedBy: session.email,
    },
    update: {
      rulesContentEn,
      rulesContentTh,
      updatedBy: session.email,
    },
  });

  await logAdmin({
    action:     "rules.update",
    targetType: "settings",
    targetId:   SETTINGS_ID,
    payload: {
      enLength: rulesContentEn.length,
      thLength: rulesContentTh.length,
      editedBy: session.email,
    },
  });

  revalidatePath("/admin/rules");
  revalidatePath("/rules");
  revalidatePath("/en/rules");
  revalidatePath("/th/rules");
  return { ok: true };
}
