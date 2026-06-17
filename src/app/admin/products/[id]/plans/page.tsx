import { notFound } from "next/navigation";
import { Coins } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { EmptyState } from "@/components/admin/EmptyState";
import { PlanForm } from "./PlanForm";
import { PlanRow } from "./PlanRow";

export default async function PlansTab({ params }: { params: { id: string } }) {
  await requireAdmin();
  const product = await db.product.findUnique({
    where: { id: params.id },
    include: { plans: { orderBy: { displayOrder: "asc" } } },
  });
  if (!product) notFound();

  return (
    <div className="space-y-s4">
      <div className="panel rounded-xl p-s4 sm:p-s5">
        <h2 className="mb-s3 font-sans text-[14px] font-extrabold uppercase tracking-[0.1em] text-fg-light">Add plan</h2>
        <PlanForm productId={product.id} mode="create" />
      </div>

      {product.plans.length === 0 ? (
        <EmptyState
          icon={<Coins size={20} />}
          title="No plans yet"
          description="Add at least one pricing plan (e.g. 30 days or lifetime) so this product can be sold."
        />
      ) : (
        <div className="panel overflow-hidden rounded-xl">
          <div className="border-b border-line-light px-s4 py-s2 font-sans text-[10px] font-extrabold uppercase tracking-[0.18em] text-fg-light-mute">
            {product.plans.length} plan{product.plans.length === 1 ? "" : "s"}
          </div>
          <ul className="divide-y divide-line-light">
            {product.plans.map((p, i) => (
              <li key={p.id} className="px-s4 py-s4">
                <PlanRow
                  productId={product.id}
                  canUp={i > 0}
                  canDown={i < product.plans.length - 1}
                  plan={{
                    id: p.id,
                    labelEn: p.labelEn,
                    labelTh: p.labelTh,
                    durationDays: p.durationDays,
                    isLifetime: p.isLifetime,
                    priceTHB: Number(p.priceTHB),
                    priceUSD: Number(p.priceUSD),
                    usdAuto: p.usdAuto,
                    isActive: p.isActive,
                    displayOrder: p.displayOrder,
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
