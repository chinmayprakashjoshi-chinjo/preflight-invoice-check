import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Ensure environment variables are loaded from backend/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com";

async function testPayPalInvoicing() {
  console.log("=========================================");
  console.log("   PayPal Sandbox REST API v2 Test");
  console.log("=========================================\n");

  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing PayPal credentials. Please ensure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are defined in backend/.env",
    );
  }

  // 1. Fetch OAuth2 Access Token using Basic Auth
  console.log("1. Requesting OAuth2 access token...");
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    const debugId = tokenRes.headers.get("paypal-debug-id");
    throw new Error(
      `Failed to obtain OAuth2 token (${tokenRes.status} ${tokenRes.statusText}): ${errorText} [debug_id: ${debugId}]`,
    );
  }

  const tokenData = (await tokenRes.json()) as { access_token: string; token_type: string; expires_in: number };
  const accessToken = tokenData.access_token;
  console.log("   ✓ Access token obtained successfully.\n");

  // 2. Create Dummy Draft Invoice
  console.log("2. Creating dummy draft invoice via POST /v2/invoicing/invoices...");
  const draftPayload = {
    detail: {
      currency_code: "USD",
      note: "PreFlight PayPal Invoicing API v2 Sandbox Test Invoice",
      payment_term: {
        term_type: "NET_30",
      },
    },
    primary_recipients: [
      {
        billing_info: {
          name: {
            given_name: "Test",
            surname: "Recipient",
          },
          email_address: "buyer-sandbox@example.com",
        },
      },
    ],
    items: [
      {
        name: "Software Consulting & Deliverables",
        quantity: "1",
        unit_amount: {
          currency_code: "USD",
          value: "100.00",
        },
      },
    ],
  };

  const createRes = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(draftPayload),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    const debugId = createRes.headers.get("paypal-debug-id");
    throw new Error(
      `Failed to create invoice (${createRes.status} ${createRes.statusText}): ${errorText} [debug_id: ${debugId}]`,
    );
  }

  const createData = (await createRes.json()) as {
    id?: string;
    href?: string;
    status?: string;
    links?: Array<{ href: string; rel: string; method: string }>;
  };

  let invoiceId = createData.id;
  if (!invoiceId && createData.href) {
    const parts = createData.href.split("/");
    invoiceId = parts[parts.length - 1];
  }
  if (!invoiceId && Array.isArray(createData.links)) {
    const selfLink = createData.links.find((l) => l.rel === "self");
    if (selfLink) {
      const parts = selfLink.href.split("/");
      invoiceId = parts[parts.length - 1];
    }
  }

  if (!invoiceId) {
    throw new Error("Invoice created but no invoice ID was returned by PayPal.");
  }

  console.log(`   ✓ Draft invoice created with ID: ${invoiceId}\n`);

  // 3. Send the Invoice
  console.log(`3. Sending invoice via POST /v2/invoicing/invoices/${invoiceId}/send...`);
  const sendRes = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices/${invoiceId}/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      send_to_recipient: true,
      send_to_invoicer: false,
    }),
  });

  if (!sendRes.ok) {
    const errorText = await sendRes.text();
    const debugId = sendRes.headers.get("paypal-debug-id");
    throw new Error(
      `Failed to send invoice (${sendRes.status} ${sendRes.statusText}): ${errorText} [debug_id: ${debugId}]`,
    );
  }

  console.log("   ✓ Invoice sent successfully.\n");

  // 4. Fetch Details to Retrieve payer_view_url
  console.log(`4. Fetching invoice details via GET /v2/invoicing/invoices/${invoiceId}...`);
  const getRes = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices/${invoiceId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!getRes.ok) {
    const errorText = await getRes.text();
    const debugId = getRes.headers.get("paypal-debug-id");
    throw new Error(
      `Failed to fetch invoice details (${getRes.status} ${getRes.statusText}): ${errorText} [debug_id: ${debugId}]`,
    );
  }

  const invoiceDetails = (await getRes.json()) as {
    id: string;
    status: string;
    detail?: {
      metadata?: {
        recipient_view_url?: string;
        invoicer_view_url?: string;
      };
    };
    links?: Array<{ href: string; rel: string; method: string }>;
  };

  const payer_view_url =
    invoiceDetails.detail?.metadata?.recipient_view_url ||
    invoiceDetails.links?.find((l) => l.rel === "payer-view" || l.rel === "recipient-view")?.href ||
    `https://www.sandbox.paypal.com/invoice/p/#${invoiceId}`;

  console.log("   ✓ Invoice details retrieved.\n");
  console.log("=========================================");
  console.log("   Result:");
  console.log("=========================================");
  console.log("paypal_invoice_id :", invoiceId);
  console.log("status            :", invoiceDetails.status);
  console.log("payer_view_url    :", payer_view_url);
  console.log("=========================================");
}

testPayPalInvoicing().catch((err) => {
  console.error("\n❌ PayPal test failed:", err.message || err);
  process.exit(1);
});
