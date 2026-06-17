"use server";

import { z } from "zod";
import { createCheckoutSession } from "@/lib/checkout";
import { setCheckoutSessionCookie } from "@/lib/checkout-cookie";

const Input = z.object({
  productId: z.string().min(1).max(50),
  planId:    z.string().min(1).max(50),
  username:  z.string().min(1).max(100),
  method:    z.enum(["promptpay", "card"]),
});

/**
 * Public checkout action — called from ProductModal's Pay Now button.
 * Returns a Stripe-hosted URL for the browser to redirect to. Also
 * pins this browser to the resulting session id so the /success page
 * can tell the original buyer from anyone who happens to have the
 * session_id link.
 */
export async function startCheckout(payload: unknown): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const parsed = Input.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid request" };
  }
  try {
    const { url, id } = await createCheckoutSession(parsed.data);
    setCheckoutSessionCookie(id);
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Checkout failed" };
  }
}
