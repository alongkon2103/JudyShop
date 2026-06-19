import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { RulesForm } from "./RulesForm";

export const metadata: Metadata = { title: "Rules" };

export default async function RulesAdminPage() {
  await requireAdmin();
  const setting = await db.setting.findUnique({ where: { id: "singleton" } });

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="System"
        title="Rules"
        subtitle="กฎของร้าน — แสดงในหน้า /rules (ใช้ TipTap: bold/list/heading ได้)"
      />
      <div className="panel rounded-xl p-4 sm:p-5">
        <RulesForm
          initialEn={setting?.rulesContentEn ?? ""}
          initialTh={setting?.rulesContentTh ?? ""}
        />
      </div>
    </section>
  );
}
