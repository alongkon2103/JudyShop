/**
 * PayPal REST API client — server-only.
 *
 * Wraps the Orders v2 API (https://developer.paypal.com/docs/api/orders/v2/).
 * We use "intent: CAPTURE" orders — the buyer approves, we capture
 * immediately on the server, money moves. No separate auth step.
 *
 * Auth: client_credentials OAuth2 to /v1/oauth2/token returns an
 * access token valid ~9h. We cache it in-process and refresh ~60s
 * before expiry. A fresh worker (PM2 cluster reload) just fetches a
 * new token on first request — no shared cache needed.
 *
 * Errors are surfaced as `PaypalError` with a tag so callers can
 * distinguish setup problems (bad creds) from buyer-facing failures
 * (denied, declined) without parsing the message.
 */
import { env } from "./env";

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE    = "https://api-m.paypal.com";

function baseUrl(): string {
  return env.PAYPAL_MODE === "live" ? LIVE_BASE : SANDBOX_BASE;
}

// ── Token cache ──────────────────────────────────────────────
// One token per process. Refresh when within 60s of expiry to absorb
// clock skew between us and PayPal.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.value;
  }
  const basic = Buffer
    .from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)
    .toString("base64");
  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    // 10s budget — PayPal token endpoint is usually <500ms; longer
    // means an outage and we'd rather fail fast than block the user.
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await safeText(res);
    throw new PaypalError("auth_failed", `PayPal token endpoint ${res.status}: ${detail}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token || !json.expires_in) {
    throw new PaypalError("auth_failed", "PayPal token response missing fields");
  }
  cachedToken = {
    value: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return cachedToken.value;
}

// ── Public types ─────────────────────────────────────────────

export type PaypalErrorTag =
  | "auth_failed"           // bad creds / token endpoint outage
  | "create_failed"         // PayPal rejected order creation (validation, currency)
  | "capture_failed"        // capture call returned non-2xx
  | "capture_not_completed" // captured but status !== COMPLETED (e.g. PENDING, DECLINED)
  | "network";              // fetch threw / aborted

export class PaypalError extends Error {
  readonly tag: PaypalErrorTag;
  constructor(tag: PaypalErrorTag, message: string) {
    super(message);
    this.name = "PaypalError";
    this.tag = tag;
  }
}

export type CreateOrderInput = {
  /** Amount in major units (e.g. 199.50 THB). PayPal wants a string with 2 decimal places. */
  amount: number;
  /** ISO currency code — we use "THB". */
  currency: string;
  /** Short human-readable description shown on the PayPal review page. */
  description: string;
  /** Custom data we want echoed back on capture — used for fulfilment lookup. */
  customId: string;
};

export type PaypalOrder = {
  id: string;
  status: string;
};

export type CaptureResult = {
  orderId: string;
  /** Always "COMPLETED" when this resolves OK — we throw otherwise. */
  status: "COMPLETED";
  /** Captured amount as PayPal reported it (string with 2dp). */
  amount: string;
  currency: string;
  captureId: string;
  /** Echoed back from CreateOrderInput.customId. */
  customId: string | null;
  /** Email of the PayPal account that paid, if PayPal returns it. */
  payerEmail: string | null;
};

// ── Public API ───────────────────────────────────────────────

export async function createOrder(input: CreateOrderInput): Promise<PaypalOrder> {
  const token = await getAccessToken();
  const body = {
    intent: "CAPTURE" as const,
    purchase_units: [
      {
        amount: {
          currency_code: input.currency,
          value: input.amount.toFixed(2),
        },
        description: input.description.slice(0, 127),
        custom_id: input.customId.slice(0, 127),
      },
    ],
    application_context: {
      // Reduce the PayPal flow to the cheapest path: skip address +
      // shipping prompts — this is a digital good, we don't need them.
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
      brand_name: "Judy Shop",
    },
  };
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new PaypalError("network", err instanceof Error ? err.message : "fetch failed");
  }
  if (!res.ok) {
    throw new PaypalError("create_failed", `PayPal create ${res.status}: ${await safeText(res)}`);
  }
  const json = (await res.json()) as { id?: string; status?: string };
  if (!json.id || !json.status) {
    throw new PaypalError("create_failed", "PayPal create response missing fields");
  }
  return { id: json.id, status: json.status };
}

export async function captureOrder(orderId: string): Promise<CaptureResult> {
  const token = await getAccessToken();
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // Empty body — orderId carries everything needed.
      body: "{}",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new PaypalError("network", err instanceof Error ? err.message : "fetch failed");
  }
  if (!res.ok) {
    throw new PaypalError("capture_failed", `PayPal capture ${res.status}: ${await safeText(res)}`);
  }
  type CaptureJson = {
    id?: string;
    status?: string;
    payer?: { email_address?: string };
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{
          id?: string;
          status?: string;
          amount?: { value?: string; currency_code?: string };
          custom_id?: string;
        }>;
      };
    }>;
  };
  const json = (await res.json()) as CaptureJson;
  const capture = json.purchase_units?.[0]?.payments?.captures?.[0];
  if (!json.id || !capture?.id || !capture.amount?.value || !capture.amount.currency_code) {
    throw new PaypalError("capture_failed", "PayPal capture response missing fields");
  }
  if (capture.status !== "COMPLETED") {
    throw new PaypalError(
      "capture_not_completed",
      `Capture status ${capture.status ?? "unknown"} (not COMPLETED)`,
    );
  }
  return {
    orderId: json.id,
    status: "COMPLETED",
    amount: capture.amount.value,
    currency: capture.amount.currency_code,
    captureId: capture.id,
    customId: capture.custom_id ?? null,
    payerEmail: json.payer?.email_address ?? null,
  };
}

// ── Helpers ──────────────────────────────────────────────────

async function safeText(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.length > 500 ? `${t.slice(0, 500)}…` : t;
  } catch {
    return "(no body)";
  }
}

/** Test-only — drops the cached token so a fresh fetch is forced. */
export function _resetTokenCacheForTests(): void {
  cachedToken = null;
}
