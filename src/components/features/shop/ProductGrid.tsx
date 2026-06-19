"use client";

import { useState } from "react";
import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";
import { ProductModal } from "@/components/features/product/ProductModal";

type Props = {
  products: Product[];
  /** Percentage surcharge applied to card payments. */
  cardFeePercent: number;
};

export function ProductGrid({ products, cardFeePercent }: Props) {
  const [selected, setSelected] = useState<Product | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
        {products.map((product, i) => (
          <div
            key={product.id}
            className="anim-fade-up h-full"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <ProductCard product={product} onSelect={setSelected} />
          </div>
        ))}
      </div>

      <ProductModal
        product={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        cardFeePercent={cardFeePercent}
      />
    </>
  );
}
