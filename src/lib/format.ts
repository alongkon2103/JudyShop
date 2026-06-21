/**
 * Display label for a Prisma `PaymentMethod` enum value. Centralised so
 * adding a new gateway (e.g. KBank QR) only touches one place — admin
 * dashboards, transaction tables, refund modals all read from here.
 */
export function paymentMethodLabel(method: string): string {
  if (method === "CARD")   return "Card";
  if (method === "PAYPAL") return "PayPal";
  return "PromptPay";
}

export function formatTHB(amount: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUSD(amount: number) {
  // USD always shows cents — checkout totals include fractional fees
  // (e.g. $19 + 10% = $20.90) and rounding to whole dollars made the
  // figure shown in ProductModal disagree with what PayPal actually
  // charged on the next page.
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
