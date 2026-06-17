import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { PartnerShareEditor } from "./PartnerShareEditor";

export default async function ProductPartnersTab({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();

  const [product, partners, shares] = await Promise.all([
    db.product.findUnique({
      where: { id: params.id },
      select: { id: true, nameEn: true },
    }),
    db.partner.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, contact: true },
    }),
    db.productPartner.findMany({
      where: { productId: params.id },
      select: { partnerId: true, sharePercent: true },
    }),
  ]);
  if (!product) notFound();

  const initialRows = shares.map((s) => ({
    partnerId:    s.partnerId,
    sharePercent: Number(s.sharePercent),
  }));

  return (
    <section className="space-y-4">
      <div className="panel rounded-xl p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold text-fg-light">Revenue share</h2>
        <p className="mt-1 text-[12px] text-fg-light-soft">
          กำหนด % ของยอดขายที่ Partner แต่ละคนได้รับจากเกมนี้ — ส่วนที่เหลือเป็น{" "}
          <strong className="text-fg-light">เงินกลาง</strong> (เจ้าของร้านร่วม)
        </p>
      </div>

      <div className="panel rounded-xl p-4 sm:p-5">
        <PartnerShareEditor
          productId={product.id}
          productName={product.nameEn}
          partners={partners}
          initialRows={initialRows}
        />
      </div>
    </section>
  );
}
