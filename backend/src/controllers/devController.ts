import { Request, Response } from "express";
import { db } from "../../lib/db.js";

/**
 * Helper to compute date strings relative to today (YYYY-MM-DD).
 */
function offsetDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function offsetIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Reseeds Supabase PostgreSQL database to initial demo state matching backend/supabase/seed.sql.
 */
export async function reseedDatabase(): Promise<void> {
  console.log("[devController] Resetting database to initial seed state...");

  // 1. Clean existing records in reverse dependency order
  await db.from("webhook_events").delete().neq("event_id", "____never_match____");
  await db.from("invoice_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("invoices").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("requirements").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("client_documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("clients").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 2. Insert Clients
  const clients = [
    {
      id: "a0000000-0000-0000-0000-000000000001",
      name: "Acme Corporation Ltd",
      legal_entity: "Acme Corporation Ltd",
      ap_email: "ap@acme.example",
    },
    {
      id: "a0000000-0000-0000-0000-000000000002",
      name: "Northwind Studio",
      legal_entity: null,
      ap_email: "finance@northwind.example",
    },
    {
      id: "a0000000-0000-0000-0000-000000000003",
      name: "Globex Inc",
      legal_entity: "Globex Inc",
      ap_email: "payables@globex.example",
    },
  ];

  const { error: clientErr } = await db.from("clients").insert(clients);
  if (clientErr) throw new Error(`Error seeding clients: ${clientErr.message}`);

  // 3. Insert Client Documents
  const documents = [
    {
      id: "d0000000-0000-0000-0000-000000000001",
      client_id: "a0000000-0000-0000-0000-000000000001",
      kind: "text",
      storage_path: null,
      source_text: `ACME CORPORATION LTD - ACCOUNTS PAYABLE & SUPPLIER INVOICING POLICY
Revision: 2026.1 | Effective: January 1, 2026

1. Invoicing Entity & Contact Information
Invoices must be addressed to our legal entity, "Acme Corporation Ltd", exactly as registered.
Submit invoices as PDF to ap@acme.example. Invoices sent elsewhere are not processed.

2. Purchase Order Requirements
All invoices must reference a valid PO number. Invoices without a PO will be returned unpaid.
Ensure your line items correspond directly to the approved deliverable descriptions.

3. Currency & Payment Terms
We process supplier payments in US Dollars (USD) only.
Standard payment terms are Net 30 from the date of a compliant invoice.
A VAT or tax ID is not required for US-based suppliers.
Multiple invoices may be attached to a single email.`,
      source_text_hash: "md5_acme_policy_2026",
    },
    {
      id: "d0000000-0000-0000-0000-000000000002",
      client_id: "a0000000-0000-0000-0000-000000000002",
      kind: "text",
      storage_path: null,
      source_text: `NORTHWIND STUDIO FREELANCER ONBOARDING GUIDE
Welcome to the Northwind creative network. Please review our invoicing standards:

1. Purchase Orders
We do not issue purchase orders for freelance engagements.
Your project manager's written scope approval serves as billing authorization.

2. Tax Identification & Currency
Please invoice in euro (EUR). We cannot pay invoices in other currencies.
Your VAT identification number must appear on every invoice.

3. Payment Schedule
We pay supplier invoices within 15 days of receipt.
Please send invoices in PDF format to finance@northwind.example.`,
      source_text_hash: "md5_northwind_onboarding_2026",
    },
    {
      id: "d0000000-0000-0000-0000-000000000003",
      client_id: "a0000000-0000-0000-0000-000000000003",
      kind: "pdf",
      storage_path: null,
      source_text: `GLOBEX INC - GLOBAL VENDOR & ACCOUNTS PAYABLE MANUAL
Section 4: External Contractor Billing Procedures

1. Entity Address & Transmission
Bill to: "Globex Inc", 1 Cypress Creek Parkway.
Invoices must go to payables@globex.example, not to your project contact.

2. Document Formatting
Submit one invoice per PDF file. Combined files will be rejected.
A PO is only required for engagements above $25,000.

3. Settlement & Currencies
Invoices may be issued in USD or EUR.
Payment terms for all vendors are Net 45.
Remittance confirmations are issued automatically upon bank clearance.`,
      source_text_hash: "md5_globex_vendor_guide_2026",
    },
  ];

  const { error: docErr } = await db.from("client_documents").insert(documents);
  if (docErr) throw new Error(`Error seeding client_documents: ${docErr.message}`);

  // 4. Insert Requirements
  const requirements = [
    // Acme
    {
      client_id: "a0000000-0000-0000-0000-000000000001",
      document_id: "d0000000-0000-0000-0000-000000000001",
      key: "poRequired",
      label: "Purchase Order Reference",
      value: true,
      evidence: "All invoices must reference a valid PO number. Invoices without a PO will be returned unpaid.",
      evidence_verified: true,
      confidence: "high",
      source: "ai",
      is_new: false,
    },
    {
      client_id: "a0000000-0000-0000-0000-000000000001",
      document_id: "d0000000-0000-0000-0000-000000000001",
      key: "legalName",
      label: "Legal Entity Name",
      value: "Acme Corporation Ltd",
      evidence: 'Invoices must be addressed to our legal entity, "Acme Corporation Ltd", exactly as registered.',
      evidence_verified: true,
      confidence: "high",
      source: "ai",
      is_new: false,
    },
    {
      client_id: "a0000000-0000-0000-0000-000000000001",
      document_id: "d0000000-0000-0000-0000-000000000001",
      key: "allowedCurrencies",
      label: "Allowed Currencies",
      value: ["USD"],
      evidence: "We process supplier payments in US Dollars (USD) only.",
      evidence_verified: true,
      confidence: "high",
      source: "ai",
      is_new: false,
    },
    {
      client_id: "a0000000-0000-0000-0000-000000000001",
      document_id: "d0000000-0000-0000-0000-000000000001",
      key: "paymentTerms",
      label: "Payment Terms",
      value: "Net 30",
      evidence: "Standard payment terms are Net 30 from the date of a compliant invoice.",
      evidence_verified: true,
      confidence: "high",
      source: "ai",
      is_new: false,
    },
    {
      client_id: "a0000000-0000-0000-0000-000000000001",
      document_id: "d0000000-0000-0000-0000-000000000001",
      key: "apEmail",
      label: "AP Submission Email",
      value: "ap@acme.example",
      evidence: "Submit invoices as PDF to ap@acme.example. Invoices sent elsewhere are not processed.",
      evidence_verified: true,
      confidence: "high",
      source: "ai",
      is_new: false,
    },
    // Northwind
    {
      client_id: "a0000000-0000-0000-0000-000000000002",
      document_id: "d0000000-0000-0000-0000-000000000002",
      key: "poRequired",
      label: "Purchase Order Reference",
      value: false,
      evidence: "We do not issue purchase orders for freelance engagements.",
      evidence_verified: true,
      confidence: "high",
      source: "ai",
      is_new: false,
    },
    {
      client_id: "a0000000-0000-0000-0000-000000000002",
      document_id: "d0000000-0000-0000-0000-000000000002",
      key: "allowedCurrencies",
      label: "Allowed Currencies",
      value: ["EUR"],
      evidence: "Please invoice in euro (EUR). We cannot pay invoices in other currencies.",
      evidence_verified: true,
      confidence: "high",
      source: "ai",
      is_new: false,
    },
    {
      client_id: "a0000000-0000-0000-0000-000000000002",
      document_id: "d0000000-0000-0000-0000-000000000002",
      key: "vatRequired",
      label: "VAT Identification",
      value: true,
      evidence: "Your VAT identification number must appear on every invoice.",
      evidence_verified: true,
      confidence: "high",
      source: "ai",
      is_new: false,
    },
    {
      client_id: "a0000000-0000-0000-0000-000000000002",
      document_id: "d0000000-0000-0000-0000-000000000002",
      key: "paymentTerms",
      label: "Payment Terms",
      value: "Net 15",
      evidence: "We pay supplier invoices within 15 days of receipt.",
      evidence_verified: true,
      confidence: "medium",
      source: "ai",
      is_new: false,
    },
    // Globex
    {
      client_id: "a0000000-0000-0000-0000-000000000003",
      document_id: "d0000000-0000-0000-0000-000000000003",
      key: "oneInvoicePerFile",
      label: "Single Invoice per PDF",
      value: true,
      evidence: "Submit one invoice per PDF file. Combined files will be rejected.",
      evidence_verified: true,
      confidence: "high",
      source: "ai",
      is_new: false,
    },
    {
      client_id: "a0000000-0000-0000-0000-000000000003",
      document_id: "d0000000-0000-0000-0000-000000000003",
      key: "apEmail",
      label: "AP Submission Email",
      value: "payables@globex.example",
      evidence: "Invoices must go to payables@globex.example, not to your project contact.",
      evidence_verified: true,
      confidence: "high",
      source: "ai",
      is_new: false,
    },
    {
      client_id: "a0000000-0000-0000-0000-000000000003",
      document_id: "d0000000-0000-0000-0000-000000000003",
      key: "paymentTerms",
      label: "Payment Terms",
      value: "Net 45",
      evidence: "Payment terms for all vendors are Net 45.",
      evidence_verified: true,
      confidence: "high",
      source: "ai",
      is_new: false,
    },
    {
      client_id: "a0000000-0000-0000-0000-000000000003",
      document_id: "d0000000-0000-0000-0000-000000000003",
      key: "legalName",
      label: "Legal Entity Name",
      value: "Globex Inc",
      evidence: 'Bill to: "Globex Inc", 1 Cypress Creek Parkway.',
      evidence_verified: true,
      confidence: "medium",
      source: "ai",
      is_new: false,
    },
    {
      client_id: "a0000000-0000-0000-0000-000000000003",
      document_id: "d0000000-0000-0000-0000-000000000003",
      key: "allowedCurrencies",
      label: "Allowed Currencies",
      value: ["USD", "EUR"],
      evidence: "Invoices may be issued in USD or EUR.",
      evidence_verified: true,
      confidence: "high",
      source: "ai",
      is_new: false,
    },
  ];

  const { error: reqErr } = await db.from("requirements").insert(requirements);
  if (reqErr) throw new Error(`Error seeding requirements: ${reqErr.message}`);

  // 5. Insert Invoices (2 Paid, 2 Overdue, 2 Sent, 1 Draft)
  const invoices = [
    {
      id: "b0000000-0000-0000-0000-000000000001",
      invoice_number: "INV-2026-0101",
      client_id: "a0000000-0000-0000-0000-000000000001",
      bill_to: "Acme Corporation Ltd",
      send_to: "ap@acme.example",
      currency: "USD",
      payment_terms: "Net 30",
      po_reference: "PO-2026-04418",
      tax_id: null,
      invoice_date: offsetDays(-70),
      due_date: offsetDays(-40),
      total: 4800.0,
      status: "paid",
      paypal_invoice_id: "SEED-INV2-0001",
      payer_view_url: "https://www.sandbox.paypal.com/invoice/p/#SEED-INV2-0001",
      preflight_summary: { blockers: 0, warnings: 0, passed: 5 },
      updated_via: "webhook",
      created_at: offsetIso(-70),
    },
    {
      id: "b0000000-0000-0000-0000-000000000002",
      invoice_number: "INV-2026-0102",
      client_id: "a0000000-0000-0000-0000-000000000002",
      bill_to: "Northwind Studio",
      send_to: "finance@northwind.example",
      currency: "EUR",
      payment_terms: "Net 15",
      po_reference: null,
      tax_id: "NL859123456B01",
      invoice_date: offsetDays(-55),
      due_date: offsetDays(-40),
      total: 2150.0,
      status: "paid",
      paypal_invoice_id: "SEED-INV2-0002",
      payer_view_url: "https://www.sandbox.paypal.com/invoice/p/#SEED-INV2-0002",
      preflight_summary: { blockers: 0, warnings: 1, passed: 4 },
      updated_via: "webhook",
      created_at: offsetIso(-55),
    },
    {
      id: "b0000000-0000-0000-0000-000000000003",
      invoice_number: "INV-2026-0103",
      client_id: "a0000000-0000-0000-0000-000000000003",
      bill_to: "Globex Inc",
      send_to: "payables@globex.example",
      currency: "USD",
      payment_terms: "Net 45",
      po_reference: null,
      tax_id: null,
      invoice_date: offsetDays(-60),
      due_date: offsetDays(-15),
      total: 6400.0,
      status: "sent",
      paypal_invoice_id: "SEED-INV2-0003",
      payer_view_url: "https://www.sandbox.paypal.com/invoice/p/#SEED-INV2-0003",
      preflight_summary: { blockers: 0, warnings: 1, passed: 4 },
      updated_via: "app",
      created_at: offsetIso(-60),
    },
    {
      id: "b0000000-0000-0000-0000-000000000004",
      invoice_number: "INV-2026-0104",
      client_id: "a0000000-0000-0000-0000-000000000002",
      bill_to: "Northwind Studio",
      send_to: "finance@northwind.example",
      currency: "EUR",
      payment_terms: "Net 15",
      po_reference: null,
      tax_id: "NL859123456B01",
      invoice_date: offsetDays(-30),
      due_date: offsetDays(-8),
      total: 980.0,
      status: "sent",
      paypal_invoice_id: "SEED-INV2-0004",
      payer_view_url: "https://www.sandbox.paypal.com/invoice/p/#SEED-INV2-0004",
      preflight_summary: { blockers: 0, warnings: 0, passed: 5 },
      updated_via: "app",
      created_at: offsetIso(-30),
    },
    {
      id: "b0000000-0000-0000-0000-000000000005",
      invoice_number: "INV-2026-0105",
      client_id: "a0000000-0000-0000-0000-000000000001",
      bill_to: "Acme Corporation Ltd",
      send_to: "ap@acme.example",
      currency: "USD",
      payment_terms: "Net 30",
      po_reference: "PO-2026-04419",
      tax_id: null,
      invoice_date: offsetDays(-9),
      due_date: offsetDays(21),
      total: 3200.0,
      status: "sent",
      paypal_invoice_id: "SEED-INV2-0005",
      payer_view_url: "https://www.sandbox.paypal.com/invoice/p/#SEED-INV2-0005",
      preflight_summary: { blockers: 0, warnings: 0, passed: 5 },
      updated_via: "app",
      created_at: offsetIso(-9),
    },
    {
      id: "b0000000-0000-0000-0000-000000000006",
      invoice_number: "INV-2026-0106",
      client_id: "a0000000-0000-0000-0000-000000000002",
      bill_to: "Northwind Studio",
      send_to: "finance@northwind.example",
      currency: "EUR",
      payment_terms: "Net 15",
      po_reference: null,
      tax_id: "NL859123456B01",
      invoice_date: offsetDays(-5),
      due_date: offsetDays(10),
      total: 1425.0,
      status: "sent",
      paypal_invoice_id: "SEED-INV2-0006",
      payer_view_url: "https://www.sandbox.paypal.com/invoice/p/#SEED-INV2-0006",
      preflight_summary: { blockers: 0, warnings: 1, passed: 4 },
      updated_via: "app",
      created_at: offsetIso(-5),
    },
    {
      id: "b0000000-0000-0000-0000-000000000007",
      invoice_number: "INV-2026-0107",
      client_id: "a0000000-0000-0000-0000-000000000003",
      bill_to: "Globex Inc",
      send_to: "payables@globex.example",
      currency: "USD",
      payment_terms: "Net 45",
      po_reference: null,
      tax_id: null,
      invoice_date: offsetDays(0),
      due_date: offsetDays(45),
      total: 5600.0,
      status: "draft",
      paypal_invoice_id: null,
      payer_view_url: null,
      preflight_summary: null,
      updated_via: "app",
      created_at: offsetIso(0),
    },
  ];

  const { error: invErr } = await db.from("invoices").insert(invoices);
  if (invErr) throw new Error(`Error seeding invoices: ${invErr.message}`);

  // 6. Insert Invoice Items
  const items = [
    {
      invoice_id: "b0000000-0000-0000-0000-000000000001",
      position: 1,
      description: "Website redesign - Phase 1 milestone",
      quantity: 1.0,
      unit_price: 4800.0,
    },
    {
      invoice_id: "b0000000-0000-0000-0000-000000000002",
      position: 1,
      description: "Brand identity sprint & asset kit",
      quantity: 1.0,
      unit_price: 2150.0,
    },
    {
      invoice_id: "b0000000-0000-0000-0000-000000000003",
      position: 1,
      description: "Cloud infrastructure audit & recommendations",
      quantity: 1.0,
      unit_price: 6400.0,
    },
    {
      invoice_id: "b0000000-0000-0000-0000-000000000004",
      position: 1,
      description: "UI UX Design Review and Usability Heuristics",
      quantity: 1.0,
      unit_price: 980.0,
    },
    {
      invoice_id: "b0000000-0000-0000-0000-000000000005",
      position: 1,
      description: "Frontend development sprint 4",
      quantity: 1.0,
      unit_price: 3200.0,
    },
    {
      invoice_id: "b0000000-0000-0000-0000-000000000006",
      position: 1,
      description: "Design system tokens and components",
      quantity: 1.0,
      unit_price: 1425.0,
    },
    {
      invoice_id: "b0000000-0000-0000-0000-000000000007",
      position: 1,
      description: "Full-stack application prototype delivery",
      quantity: 1.0,
      unit_price: 5600.0,
    },
  ];

  const { error: itemErr } = await db.from("invoice_items").insert(items);
  if (itemErr) throw new Error(`Error seeding invoice_items: ${itemErr.message}`);

  console.log("[devController] ✓ Successfully reseeded database to initial demo state!");
}

/**
 * POST /api/dev/reset
 * API-14: Reseeds Supabase from seed fixtures on demand when DEMO_MODE=true.
 */
export async function resetDevData(_req: Request, res: Response) {
  try {
    if (process.env.DEMO_MODE !== "true") {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Database reset is only permitted when DEMO_MODE=true in environment.",
        },
      });
    }

    await reseedDatabase();
    return res.status(200).json({ ok: true, message: "Database reseeded successfully." });
  } catch (err: any) {
    console.error("[devController] resetDevData error:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL",
        message: err.message || "Failed to reset database",
      },
    });
  }
}

export default {
  reseedDatabase,
  resetDevData,
};
