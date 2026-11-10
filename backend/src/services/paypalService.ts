import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com";

export interface LineItemInput {
  name: string;
  quantity: number | string;
  unitAmount: number | string;
  description?: string;
}

export interface CreateInvoiceInput {
  invoiceNumber?: string;
  reference?: string; // PO number (max 120 chars)
  currency: "USD" | "EUR";
  invoiceDate?: string; // YYYY-MM-DD
  paymentTerms?: string; // e.g. "Net 30", "Net 15", "Net 45"
  note?: string;
  recipientEmail: string;
  recipientName?: string;
  items: LineItemInput[];
}

export interface PayPalInvoiceResult {
  paypalInvoiceId: string;
  payerLink: string;
  status: string;
  invoiceNumber?: string;
}

// Token cache in-memory
let cachedToken: {
  accessToken: string;
  expiresAt: number;
} | null = null;

/**
 * Retrieves OAuth2 access token from PayPal Sandbox using HTTP Basic Auth.
 * Caches the token in-memory to prevent repeated token requests.
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing PayPal credentials in environment. Ensure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are defined in backend/.env",
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const debugId = response.headers.get("paypal-debug-id");
    const error = new Error(`PayPal OAuth failed (${response.status}): ${errorBody} [debug_id: ${debugId}]`);
    (error as unknown as { debugId?: string; statusCode?: number }).debugId = debugId || undefined;
    (error as unknown as { debugId?: string; statusCode?: number }).statusCode = 502;
    throw error;
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

/**
 * Creates a draft invoice in PayPal Sandbox via POST /v2/invoicing/invoices.
 */
export async function createDraftInvoice(input: CreateInvoiceInput): Promise<string> {
  const token = await getAccessToken();

  // Normalize payment terms to PayPal's term_type or use default NET_30
  let termType = "NET_30";
  if (input.paymentTerms) {
    const termNum = input.paymentTerms.replace(/\D/g, "");
    if (termNum === "15") termType = "NET_15";
    else if (termNum === "30") termType = "NET_30";
    else if (termNum === "45") termType = "NET_45";
    else if (termNum === "60") termType = "NET_60";
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const invoiceDate = input.invoiceDate || todayIso;

  const payload: Record<string, unknown> = {
    detail: {
      currency_code: input.currency,
      invoice_date: invoiceDate,
      payment_term: {
        term_type: termType,
      },
      note: input.note || "Invoice generated via PreFlight Invoice Co-Pilot",
      ...(input.invoiceNumber ? { invoice_number: input.invoiceNumber } : {}),
      ...(input.reference ? { reference: input.reference.slice(0, 120) } : {}),
    },
    primary_recipients: [
      {
        billing_info: {
          name: {
            given_name: input.recipientName || "Valued",
            surname: input.recipientName ? "Client" : "Customer",
          },
          email_address: input.recipientEmail,
        },
      },
    ],
    items: input.items.map((item) => ({
      name: item.name.slice(0, 300),
      description: item.description?.slice(0, 4000),
      quantity: String(item.quantity),
      unit_amount: {
        currency_code: input.currency,
        value: Number(item.unitAmount).toFixed(2),
      },
    })),
  };

  const response = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const debugId = response.headers.get("paypal-debug-id");
    const error = new Error(`PayPal create invoice failed (${response.status}): ${errorBody} [debug_id: ${debugId}]`);
    (error as unknown as { debugId?: string; statusCode?: number }).debugId = debugId || undefined;
    (error as unknown as { debugId?: string; statusCode?: number }).statusCode = 502;
    throw error;
  }

  const result = (await response.json()) as {
    id?: string;
    href?: string;
    links?: Array<{ href: string; rel: string }>;
  };

  let invoiceId = result.id;
  if (!invoiceId && result.href) {
    const parts = result.href.split("/");
    invoiceId = parts[parts.length - 1];
  }
  if (!invoiceId && Array.isArray(result.links)) {
    const selfLink = result.links.find((l) => l.rel === "self");
    if (selfLink) {
      const parts = selfLink.href.split("/");
      invoiceId = parts[parts.length - 1];
    }
  }

  if (!invoiceId) {
    throw new Error("PayPal invoice created successfully, but invoice ID could not be parsed from response.");
  }

  return invoiceId;
}

/**
 * Sends a draft invoice via POST /v2/invoicing/invoices/{id}/send.
 */
export async function sendInvoice(invoiceId: string): Promise<boolean> {
  const token = await getAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices/${invoiceId}/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      send_to_recipient: true,
      send_to_invoicer: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const debugId = response.headers.get("paypal-debug-id");
    const error = new Error(`PayPal send invoice failed (${response.status}): ${errorBody} [debug_id: ${debugId}]`);
    (error as unknown as { debugId?: string; statusCode?: number }).debugId = debugId || undefined;
    (error as unknown as { debugId?: string; statusCode?: number }).statusCode = 502;
    throw error;
  }

  return true;
}

/**
 * Retrieves invoice details via GET /v2/invoicing/invoices/{id}.
 */
export async function getInvoice(invoiceId: string): Promise<{
  id: string;
  status: string;
  payerLink: string;
  invoiceNumber?: string;
}> {
  const token = await getAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices/${invoiceId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const debugId = response.headers.get("paypal-debug-id");
    const error = new Error(`PayPal get invoice failed (${response.status}): ${errorBody} [debug_id: ${debugId}]`);
    (error as unknown as { debugId?: string; statusCode?: number }).debugId = debugId || undefined;
    (error as unknown as { debugId?: string; statusCode?: number }).statusCode = 502;
    throw error;
  }

  const details = (await response.json()) as {
    id: string;
    status: string;
    detail?: {
      invoice_number?: string;
      metadata?: {
        recipient_view_url?: string;
        invoicer_view_url?: string;
      };
    };
    links?: Array<{ href: string; rel: string }>;
  };

  const payerLink =
    details.detail?.metadata?.recipient_view_url ||
    details.links?.find((l) => l.rel === "payer-view" || l.rel === "recipient-view")?.href ||
    `https://www.sandbox.paypal.com/invoice/p/#${invoiceId}`;

  return {
    id: details.id,
    status: details.status,
    payerLink,
    invoiceNumber: details.detail?.invoice_number,
  };
}

/**
 * High-level service method: creates draft invoice, sends it, and fetches the live payer view URL.
 */
export async function createAndSendInvoice(input: CreateInvoiceInput): Promise<PayPalInvoiceResult> {
  const invoiceId = await createDraftInvoice(input);
  await sendInvoice(invoiceId);
  const details = await getInvoice(invoiceId);

  return {
    paypalInvoiceId: details.id,
    payerLink: details.payerLink,
    status: details.status.toLowerCase(),
    invoiceNumber: details.invoiceNumber,
  };
}

export default {
  getAccessToken,
  createDraftInvoice,
  sendInvoice,
  getInvoice,
  createAndSendInvoice,
};
