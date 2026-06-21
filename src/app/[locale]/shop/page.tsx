import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { ProductGrid } from "@/components/features/shop/ProductGrid";
import { getActiveProducts } from "@/lib/products";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import type { Locale } from "@/lib/locale";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "shop" });
  return { title: t("title"), description: t("subtitle") };
}

// Re-fetch the catalogue on each request so admin edits show up
// immediately. Admin actions also revalidatePath('/admin/products') —
// we keep the public shop simple by forcing dynamic for now.
export const dynamic = "force-dynamic";

export default async function ShopPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "shop" });

  const [products, settings] = await Promise.all([
    getActiveProducts(params.locale as Locale),
    getSettings(),
  ]);

  return (
    <section className="py-s5 sm:py-s6">
      <Container>
        <header className="anim-fade-up mx-auto mb-s5 max-w-2xl text-center">
          <h1 className="font-hero text-[36px] uppercase tracking-wide text-fg-dark sm:text-[56px]">
            {t("title")}
          </h1>
          <p className="mt-2 font-sans text-[12px] font-extrabold uppercase tracking-[0.2em] text-fg-dark-soft sm:text-[13px]">
            {t("subtitle")}
          </p>
        </header>

        {products.length === 0 ? (
          <EmptyShop emptyTitle={t("empty")} emptyHint={t("emptyHint")} />
        ) : (
          <ProductGrid
            products={products}
            cardFeePercent={settings.cardFeePercent}
            paypalFeePercent={settings.paypalFeePercent}
            paypalClientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ""}
            paypalCurrency={env.PAYPAL_CURRENCY}
            promptpayEnabled={settings.promptpayEnabled}
            cardEnabled={settings.cardEnabled}
            paypalEnabled={settings.paypalEnabled}
          />
        )}
      </Container>
    </section>
  );
}

function EmptyShop({ emptyTitle, emptyHint }: { emptyTitle: string; emptyHint: string }) {
  return (
    <div className="glass mx-auto max-w-md rounded-xl p-s5 text-center">
      <p className="font-display text-[22px] text-fg-dark">{emptyTitle}</p>
      <p className="mt-2 text-[13px] text-fg-dark-soft">{emptyHint}</p>
    </div>
  );
}
