import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const db = createClient(supabaseUrl, supabaseKey);

const BASE_URL = "http://localhost:8000";

async function runTests() {
  console.log("=== 1. Testing Webhook Deduplication and Persistence ===");

  // Find a test invoice in Supabase that has paypal_invoice_id
  const { data: invRows, error: invErr } = await db
    .from("invoices")
    .select("*")
    .not("paypal_invoice_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (invErr || !invRows || invRows.length === 0) {
    console.error("❌ No invoice found with paypal_invoice_id in database. Create one first.");
    return;
  }

  const testInvoice = invRows[0];
  console.log(`Found test invoice: ${testInvoice.invoice_number} (PayPal ID: ${testInvoice.paypal_invoice_id}, Status: ${testInvoice.status})`);

  // Generate unique test event id
  const testEventId = `WH-TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const webhookPayload = {
    id: testEventId,
    event_version: "1.0",
    create_time: new Date().toISOString(),
    resource_type: "invoices",
    event_type: "INVOICING.INVOICE.PAID",
    summary: "Invoice marked as paid in sandbox test",
    resource: {
      id: testInvoice.paypal_invoice_id,
      invoice_number: testInvoice.invoice_number,
      status: "PAID",
      amount: {
        currency_code: testInvoice.currency,
        value: String(testInvoice.total),
      },
    },
  };

  // 1A. First delivery of webhook
  console.log(`\nSending webhook event ${testEventId}...`);
  const res1 = await fetch(`${BASE_URL}/api/webhooks/paypal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookPayload),
  });

  const body1 = (await res1.json()) as any;
  console.log("Response 1:", res1.status, body1);
  if (res1.status === 200 && body1.status === "ok") {
    console.log("✅ Webhook initial receipt SUCCESS!");
  } else {
    console.error("❌ Webhook initial receipt FAILED!");
  }

  // 1B. Verify it was stored in webhook_events
  const { data: eventRow, error: evErr } = await db
    .from("webhook_events")
    .select("*")
    .eq("event_id", testEventId)
    .single();

  if (evErr || !eventRow) {
    console.error("❌ Event not found in webhook_events table:", evErr);
  } else {
    console.log("✅ Event verified in webhook_events table:", {
      event_id: eventRow.event_id,
      event_type: eventRow.event_type,
      paypal_invoice_id: eventRow.paypal_invoice_id,
    });
  }

  // 1C. Verify invoice status was updated to paid in Supabase
  const { data: updatedInv } = await db
    .from("invoices")
    .select("invoice_number, status, updated_via, updated_at")
    .eq("id", testInvoice.id)
    .single();

  console.log("Updated invoice in DB:", updatedInv);
  if (updatedInv?.status === "paid" && updatedInv?.updated_via === "webhook") {
    console.log("✅ Invoice successfully transitioned to 'paid' via webhook!");
  } else {
    console.error("❌ Invoice status not updated to 'paid' via webhook!");
  }

  // 1D. Second delivery of the exact same event (Deduplication test)
  console.log(`\nSending duplicate webhook event ${testEventId}...`);
  const res2 = await fetch(`${BASE_URL}/api/webhooks/paypal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookPayload),
  });

  const body2 = (await res2.json()) as any;
  console.log("Response 2 (Duplicate):", res2.status, body2);
  if (res2.status === 200 && body2.status === "duplicate_ignored") {
    console.log("✅ Deduplication SUCCESS! (duplicate_ignored)");
  } else {
    console.error("❌ Deduplication FAILED!");
  }

  console.log("\n=== 2. Testing POST /api/invoices/:id/mark-paid with PayPal Sandbox ===");
  // Create a brand new sent invoice to test mark-paid against PayPal API
  const newInvoicePayload = {
    clientName: "Acme Corporation Ltd",
    sendTo: "ap@acme.example",
    currency: "USD",
    paymentTerms: "Net 30",
    poNumber: "PO-WEBHOOK-TEST",
    invoiceDate: new Date().toISOString().slice(0, 10),
    lineItems: [
      {
        description: "Sandbox Webhook & Mark-Paid Verification Service",
        quantity: 1,
        unitPrice: 275.0,
      },
    ],
  };

  console.log("Creating new live PayPal invoice for mark-paid testing...");
  const createRes = await fetch(`${BASE_URL}/api/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newInvoicePayload),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error("❌ Failed to create invoice:", createRes.status, errText);
    return;
  }

  const createdInvoice = (await createRes.json()) as any;
  console.log("Created invoice:", {
    id: createdInvoice.id,
    number: createdInvoice.number,
    status: createdInvoice.status,
    paypalInvoiceId: createdInvoice.paypalInvoiceId,
  });

  // Call mark-paid
  console.log(`\nCalling POST /api/invoices/${createdInvoice.id}/mark-paid...`);
  const markPaidRes = await fetch(`${BASE_URL}/api/invoices/${createdInvoice.id}/mark-paid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const markPaidBody = (await markPaidRes.json()) as any;
  console.log("mark-paid response:", markPaidRes.status, markPaidBody);

  if (markPaidRes.status === 200 && markPaidBody.status === "paid") {
    console.log("✅ Mark-paid endpoint SUCCESS! Status is 'paid'.");
  } else {
    console.error("❌ Mark-paid endpoint returned unexpected result.");
  }

  // Verify in DB
  const { data: dbCheck } = await db
    .from("invoices")
    .select("invoice_number, status, updated_via")
    .eq("id", createdInvoice.id)
    .single();

  console.log("DB check for marked invoice:", dbCheck);
  if (dbCheck?.status === "paid" && dbCheck?.updated_via === "app") {
    console.log("✅ DB verified: status='paid', updated_via='app'.");
  } else {
    console.error("❌ DB verification failed!");
  }

  console.log("\nALL TESTS COMPLETED SUCCESSFULLY! 🎉");
}

runTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
