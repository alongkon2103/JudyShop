import Stripe from "stripe";
import { env } from "./env";

/** Server-only Stripe client. Don't import this from a "use client" file. */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  typescript: true,
});

export type CheckoutMetadata = {
  productId: string;
  planId: string;
  username: string;
};
