import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/admin/PageHeader";
import { NewProductForm } from "./NewProductForm";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireAdmin();

  return (
    <section className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Products", href: "/admin/products" }, { label: "New" }]}
        kicker="Catalogue"
        title="New product"
        subtitle="กรอกข้อมูลเป็นทั้งภาษาอังกฤษ (EN) และภาษาไทย (TH) — แบบฟอร์มจะแสดงในเว็บตามภาษาที่ผู้ใช้เลือก"
      />

      <div className="panel rounded-xl p-s4 sm:p-s5">
        <NewProductForm />
      </div>
    </section>
  );
}
