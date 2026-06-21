import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-session";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/PageHeader";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();

  return (
    <section className="space-y-6">
      <PageHeader
        kicker="System"
        title="Settings"
        subtitle="ค่าทั่วไปของระบบ — รวมถึงค่าธรรมเนียมการชำระเงิน"
      />

      <div className="panel mx-auto max-w-2xl rounded-xl p-4 sm:p-6">
        <h2 className="mb-3 text-[15px] font-semibold text-fg-light">Payment fees</h2>
        <p className="mb-4 text-[13px] text-fg-light-soft">
          ค่าธรรมเนียมจะถูกบวกเพิ่มจากราคาสินค้าตอนผู้ใช้เลือกจ่ายด้วยบัตรเครดิต หรือ PayPal ·
          PromptPay ไม่บวกค่าธรรมเนียม
        </p>
        <SettingsForm initial={settings} />
      </div>
    </section>
  );
}
