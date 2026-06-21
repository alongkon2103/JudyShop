"use client";

/**
 * PayPal Smart Buttons.
 *
 * Loads the PayPal JS SDK lazily via a <script> tag on first mount,
 * then renders the official PayPal/Card buttons that handle the
 * approval popup. No npm dependency — the SDK is fetched from
 * paypal.com so it never inflates our bundle.
 *
 * Flow:
 *   1. createOrder()   → POST /api/paypal/create-order (server makes PayPal order)
 *   2. user approves   → PayPal's popup
 *   3. onApprove()     → POST /api/paypal/capture-order (server captures + fulfils)
 *   4. on success      → redirect to the /success URL the server returned
 *
 * The SDK script is loaded once per page-load and reused — re-mounting
 * (e.g. swapping selected plan) just re-renders new buttons against the
 * already-loaded `window.paypal` namespace.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: PaypalButtonsOptions) => { render: (el: HTMLElement) => Promise<void> };
    };
  }
}

type PaypalButtonsOptions = {
  style?: {
    layout?: "vertical" | "horizontal";
    color?:  "gold" | "blue" | "silver" | "white" | "black";
    shape?:  "rect" | "pill";
    label?:  "paypal" | "checkout" | "buynow" | "pay";
    height?: number;
  };
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onCancel?: () => void;
  onError?: (err: unknown) => void;
};

type Props = {
  /** Public client id — Next inlines NEXT_PUBLIC_PAYPAL_CLIENT_ID at build time. */
  clientId: string;
  /** ISO currency code (THB or USD) — MUST match what the server uses
   *  when it creates the order, or PayPal rejects with a confusing
   *  generic error. Passed from the server (env.PAYPAL_CURRENCY) via
   *  props rather than read here from a parallel NEXT_PUBLIC_ env var,
   *  so the two sides can never silently drift. */
  currency: string;
  productId: string;
  planId: string;
  username: string;
  /** Disable button rendering until the form is valid (plan + username). */
  disabled: boolean;
  /** Surface errors to the parent so it can show them next to the buttons. */
  onError?: (msg: string) => void;
  /** Called after capture succeeds — typically navigates to /success. */
  onSuccess?: (redirectUrl: string) => void;
};

const SDK_BASE = "https://www.paypal.com/sdk/js";
//
// `disable-funding` hides:
//   credit, paylater → PayPal Credit / Pay-Later (US-only finance products)
//   card             → the standalone "Debit or Credit Card" button that
//                      PayPal otherwise renders below ours with a hard
//                      white background — we already offer a Stripe Card
//                      option in the same modal, so this avoids confusing
//                      the buyer and matches the dark theme.
function sdkUrl(clientId: string, currency: string): string {
  const params = new URLSearchParams({
    "client-id":  clientId,
    currency:     currency.toUpperCase(),
    intent:       "capture",
    "disable-funding": "credit,paylater,card",
  });
  return `${SDK_BASE}?${params.toString()}`;
}

// One promise per (clientId, currency) combo. Calling sdkUrl with a
// different currency requires a fresh script tag — we key the cache
// so changing config in dev or supporting multiple SDK URLs is safe.
const sdkPromises = new Map<string, Promise<void>>();

function loadPaypalSdk(clientId: string, currency: string): Promise<void> {
  const key = `${clientId}|${currency.toUpperCase()}`;
  const existing = sdkPromises.get(key);
  if (existing) return existing;
  if (typeof window !== "undefined" && window.paypal) {
    const ready = Promise.resolve();
    sdkPromises.set(key, ready);
    return ready;
  }
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = sdkUrl(clientId, currency);
    script.async = true;
    script.onload  = () => resolve();
    script.onerror = () => {
      // Drop from cache so a later retry can try again.
      sdkPromises.delete(key);
      reject(new Error("paypal sdk load failed"));
    };
    document.head.appendChild(script);
  });
  sdkPromises.set(key, promise);
  return promise;
}

export function PayPalButtons({
  clientId,
  currency,
  productId,
  planId,
  username,
  disabled,
  onError,
  onSuccess,
}: Props) {
  const t = useTranslations("product");
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady]   = useState(false);
  const [busy, setBusy]     = useState(false);

  // Refs so callbacks always see the latest form values without
  // forcing the buttons to re-render (re-rendering loses cache + flickers).
  const productIdRef = useRef(productId);
  const planIdRef    = useRef(planId);
  const usernameRef  = useRef(username);
  const disabledRef  = useRef(disabled);
  const onErrorRef   = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => { productIdRef.current = productId; }, [productId]);
  useEffect(() => { planIdRef.current    = planId;    }, [planId]);
  useEffect(() => { usernameRef.current  = username;  }, [username]);
  useEffect(() => { disabledRef.current  = disabled;  }, [disabled]);
  useEffect(() => { onErrorRef.current   = onError;   }, [onError]);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);

  // Load the SDK once on mount.
  useEffect(() => {
    let cancelled = false;
    loadPaypalSdk(clientId, currency)
      .then(() => { if (!cancelled) setReady(true); })
      .catch((err) => {
        console.error("[PayPalButtons] SDK load failed:", err);
        if (!cancelled) onErrorRef.current?.(t("paypalSdkError"));
      });
    return () => { cancelled = true; };
  }, [clientId, currency, t]);

  // Render the buttons once the SDK is ready. We render exactly once
  // per mount — PayPal's button does its own redraws when funding
  // sources update. Re-rendering causes a flash and breaks the popup.
  useEffect(() => {
    if (!ready || !containerRef.current || !window.paypal) return;
    const el = containerRef.current;
    const buttons = window.paypal.Buttons({
      // shape:"rect" makes the yellow fill the iframe edge-to-edge —
      // no white margins around a centered pill. The wrapper then
      // clips the iframe with rounded-full to give the visual pill
      // shape buyers expect. Combining rect inside a pill wrapper is
      // what removes the last bits of white at the corners.
      style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal", height: 48 },
      createOrder: async () => {
        if (disabledRef.current) {
          throw new Error("disabled");
        }
        setBusy(true);
        try {
          const res = await fetch("/api/paypal/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: productIdRef.current,
              planId:    planIdRef.current,
              username:  usernameRef.current,
            }),
          });
          const json = (await res.json()) as { id?: string; error?: string };
          if (!res.ok || !json.id) {
            throw new Error(json.error ?? "create-order failed");
          }
          return json.id;
        } finally {
          setBusy(false);
        }
      },
      onApprove: async (data) => {
        setBusy(true);
        try {
          const res = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderID: data.orderID }),
          });
          const json = (await res.json()) as { ok?: boolean; redirectUrl?: string; error?: string };
          if (!res.ok || !json.ok || !json.redirectUrl) {
            throw new Error(json.error ?? "capture failed");
          }
          onSuccessRef.current?.(json.redirectUrl);
        } catch (err) {
          console.error("[PayPalButtons] capture failed:", err);
          onErrorRef.current?.(err instanceof Error ? err.message : t("paypalCaptureError"));
        } finally {
          setBusy(false);
        }
      },
      onCancel: () => {
        // User dismissed the PayPal popup — not an error.
        setBusy(false);
      },
      onError: (err) => {
        console.error("[PayPalButtons] SDK error:", err);
        onErrorRef.current?.(t("paypalCaptureError"));
        setBusy(false);
      },
    });
    buttons.render(el).catch((err) => {
      console.error("[PayPalButtons] render failed:", err);
      onErrorRef.current?.(t("paypalSdkError"));
    });
    return () => {
      // Clean up the rendered iframe so the next mount draws fresh.
      el.innerHTML = "";
    };
  }, [ready, t]);

  return (
    <div className="space-y-2">
      {/* shape:"rect" inside a rounded-full clip = clean pill, zero
          white edges. The fixed h-[48px] matches the SDK button height
          so the clip doesn't shave a pixel off the top/bottom. */}
      <div
        ref={containerRef}
        data-busy={busy ? "true" : "false"}
        className={cn(
          "h-[48px] overflow-hidden rounded-full bg-transparent",
          "[&_iframe]:!h-[48px] [&_iframe]:!my-0",
          "[&>div]:!min-h-0 [&>div]:!h-[48px]",
          "[&[data-busy=true]]:pointer-events-none [&[data-busy=true]]:opacity-60",
        )}
      />
      {!ready && (
        <p className="text-center text-[12px] text-fg-light-soft">{t("paypalLoading")}</p>
      )}
    </div>
  );
}
