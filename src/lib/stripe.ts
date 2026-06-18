import Stripe from "stripe";
import { env } from "./env";

/**
 * Server-only Stripe client. Don't import this from a "use client" file.
 *
 * apiVersion is pinned so Stripe doesn't silently roll our account to a
 * newer schema with subtly different response shapes. Bump intentionally
 * after testing each new version.
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
  typescript: true,
});

export type CheckoutMetadata = {
  productId: string;
  planId: string;
  username: string;
};
