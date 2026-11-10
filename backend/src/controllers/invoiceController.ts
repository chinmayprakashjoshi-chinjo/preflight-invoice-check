import { Request, Response } from "express";
import { db } from "../../lib/db";
import { resolveClient } from "./clientController";
import { createAndSendInvoice } from "../services/paypalService";
import { validateInvoiceWithAICoPilot } from "../services/aiService";
import { dueDateFor, termsToDays } from "../../../shared/format";
import type { DraftInvoice, LineItem, Currency, PaymentTerms, ClientRequirements } from "../../../shared/types";

/**
 * Normalizes input from frontend into a typed DraftInvoice structure.
 */
function normalizeInvoiceInput(body: any): DraftInvoice {
  const lineItems: LineItem[] = Array.isArray(body.items || body.lineItems)
    ? (body.items || body.lineItems).map((item: any, index: number) => ({
        id: item.id ? String(item.id) : `item-${index + 1}`,
        description: String(item.description || item.name || "Services rendered"),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitPrice: Math.max(0, Number(item.unitPrice ?? item.unit_price ?? item.unitAmount ?? item.amount ?? 0)),
      }))
    : [
        {
          id: "item-1",
          description: "Professional Services",
          quantity: 1,
          unitPrice: Math.max(0, Number(body.total || body.amount || 100)),
        },
      ];

  const currency: Currency = body.currency === "EUR" ? "EUR" : "USD";

  let paymentTerms: PaymentTerms = "Net 30";
  const rawTerms = String(body.paymentTerms || body.payment_terms || "Net 30");
  if (rawTerms.includes("15")) paymentTerms = "Net 15";
  else if (rawTerms.includes("45")) paymentTerms = "Net 45";

  return {
    clientId: body.clientId || body.client_id || null,
    clientName: String(body.clientName || body.client_name || body.billTo || body.bill_to || "Valued Client"),
    sendTo: String(body.sendTo || body.send_to || body.recipientEmail || body.recipient_email || "billing@example.com"),
    currency,
    paymentTerms,
    poNumber: String(body.poNumber || body.po_number || body.poReference || body.po_reference || ""),
    vatId: String(body.vatId || body.vat_id || body.taxId || body.tax_id || ""),
    invoiceDate: String(body.invoiceDate || body.invoice_date || new Date().toISOString().slice(0, 10)),
    lineItems,
  };
}

/**
 * Generates an invoice number: checks database max sequence or falls back to timestamp.
 */
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const { data, error } = await db.rpc("next_invoice_number", { target_year: year });
    if (!error && data) {
      return String(data);
    }
  } catch {
    // If RPC is unavailable, calculate from max invoice number
  }

  try {
    const { data } = await db
      .from("invoices")
      .select("invoice_number")
      .ilike("invoice_number", `INV-${year}-%`)
      .order("invoice_number", { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0]?.invoice_number) {
      const match = data[0].invoice_number.match(/INV-\d{4}-(\d+)/);
      if (match && match[1]) {
        const nextNum = parseInt(match[1], 10) + 1;
        return `INV-${year}-${String(nextNum).padStart(4, "0")}`;
      }
    }
  } catch (err) {
    console.warn("[invoiceController] Error querying existing invoice numbers:", err);
  }

  const randomSeq = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}-${randomSeq}`;
}

/**
 * Fetches requirements for a client live from Supabase.
 */
async function fetchClientRequirements(clientId?: string | null, clientName?: string): Promise<{
  clientId: string | null;
  requirements: ClientRequirements | null;
}> {
  if (!clientId && !clientName) {
    return { clientId: null, requirements: null };
  }

  try {
    const client = await resolveClient(clientId || clientName || "");
    if (!client) {
      console.warn(`[invoiceController] Client not found for id='${clientId}' or name='${clientName}'`);
      return { clientId: null, requirements: null };
    }

    const resolvedClientId = client.id;

    // Fresh query directly from Supabase requirements table
    const { data: reqRows, error } = await db
      .from("requirements")
      .select("key, value, evidence, confidence")
      .eq("client_id", resolvedClientId);

    if (error || !reqRows || reqRows.length === 0) {
      console.warn(`[invoiceController] No requirements found in Supabase for client ${client.name} (${resolvedClientId})`);
      return { clientId: resolvedClientId, requirements: null };
    }

    // Map DB requirement rows into ClientRequirements
    const meta: Record<string, { evidence: string; confidence: "high" | "medium" | "low" }> = {};
    let poRequired = false;
    let legalName: string | undefined = client.legal_entity || undefined;
    let allowedCurrencies: Currency[] = ["USD"];
    let vatRequired = false;
    let paymentTerms: PaymentTerms = "Net 30";
    let apEmail: string | undefined = client.ap_email || undefined;
    let oneInvoicePerFile = false;

    for (const r of reqRows) {
      meta[r.key] = { evidence: r.evidence, confidence: r.confidence as any };
      if (r.key === "poRequired") poRequired = Boolean(r.value);
      if (r.key === "legalName") legalName = String(r.value).replace(/^"|"$/g, "");
      if (r.key === "allowedCurrencies" && Array.isArray(r.value)) allowedCurrencies = r.value;
      if (r.key === "vatRequired") vatRequired = Boolean(r.value);
      if (r.key === "paymentTerms") paymentTerms = r.value as PaymentTerms;
      if (r.key === "apEmail") apEmail = String(r.value).replace(/^"|"$/g, "");
      if (r.key === "oneInvoicePerFile") oneInvoicePerFile = Boolean(r.value);
    }

    const requirements: ClientRequirements = {
      poRequired,
      legalName,
      allowedCurrencies,
      vatRequired,
      paymentTerms,
      apEmail,
      oneInvoicePerFile,
      meta: meta as any,
    };

    console.log(`[invoiceController] Fresh requirements loaded from Supabase for ${client.name}: poRequired = ${poRequired}`);
    return { clientId: resolvedClientId, requirements };
  } catch (err) {
    console.warn("[invoiceController] Could not load client requirements from db:", err);
    return { clientId: null, requirements: null };
  }
}

/**
 * POST /api/invoices/generate
 * - Receives invoice data
 * - Validates using AI Co-pilot & pre-flight rules
 * - Generates invoice in PayPal Sandbox
 * - Saves record and line items to Supabase
 * - Returns live payer_view_url
 */
export async function generateInvoice(req: Request, res: Response) {
  try {
    const draft = normalizeInvoiceInput(req.body);

    // 1. Resolve client requirements
    const { clientId, requirements } = await fetchClientRequirements(draft.clientId, draft.clientName);
    if (clientId) draft.clientId = clientId;

    // 2. Run AI Co-pilot validation
    const assessment = await validateInvoiceWithAICoPilot(draft, requirements);

    // If pre-flight has blockers, reject per PRD Section 11.3 & CLAUDE.md Hard Rule 6
    if (!assessment.approved || assessment.blockers.length > 0) {
      return res.status(422).json({
        error: {
          code: "BLOCKERS_PRESENT",
          message: `Resolve ${assessment.blockers.length} blocker(s) before sending.`,
          details: {
            blockers: assessment.blockers,
            warnings: assessment.warnings,
            aiReview: assessment.aiReview,
          },
        },
      });
    }

    // 3. Generate invoice number and total
    const invoiceNumber = await generateInvoiceNumber();
    const total = Math.round(
      draft.lineItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0) * 100,
    ) / 100;

    const dueDate = dueDateFor({
      invoiceDate: draft.invoiceDate,
      paymentTerms: draft.paymentTerms,
    });

    // 4. Create and Send Invoice via PayPal REST Invoicing API v2
    console.log(`[invoiceController] Creating & sending invoice ${invoiceNumber} via PayPal Sandbox...`);
    const paypalResult = await createAndSendInvoice({
      invoiceNumber,
      reference: draft.poNumber || undefined,
      currency: draft.currency,
      invoiceDate: draft.invoiceDate,
      paymentTerms: draft.paymentTerms,
      recipientEmail: draft.sendTo,
      recipientName: draft.clientName,
      items: draft.lineItems.map((item) => ({
        name: item.description,
        quantity: item.quantity,
        unitAmount: item.unitPrice,
      })),
    });

    // 5. Persist Invoice Record in Supabase
    let savedInvoiceId: string | null = null;
    try {
      const { data: invRow, error: invError } = await db
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          client_id: clientId || null,
          bill_to: draft.clientName,
          send_to: draft.sendTo,
          currency: draft.currency,
          payment_terms: draft.paymentTerms,
          po_reference: draft.poNumber || null,
          tax_id: draft.vatId || null,
          invoice_date: draft.invoiceDate,
          due_date: dueDate,
          total,
          status: "sent",
          paypal_invoice_id: paypalResult.paypalInvoiceId,
          payer_view_url: paypalResult.payerLink,
          preflight_summary: {
            blockers: 0,
            warnings: assessment.warnings.length,
            passed: assessment.passed.length,
            aiReview: assessment.aiReview,
          },
          updated_via: "app",
        })
        .select("id")
        .single();

      if (!invError && invRow) {
        savedInvoiceId = invRow.id;

        // Insert Line Items
        const itemsToInsert = draft.lineItems.map((item, index) => ({
          invoice_id: savedInvoiceId,
          position: index + 1,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        }));

        await db.from("invoice_items").insert(itemsToInsert);
      } else if (invError) {
        console.warn("[invoiceController] Warning: Could not save invoice to DB:", invError.message);
      }
    } catch (dbErr: any) {
      console.warn("[invoiceController] DB insert error:", dbErr.message || dbErr);
    }

    return res.status(201).json({
      success: true,
      message: "Invoice successfully validated, sent via PayPal Sandbox, and recorded.",
      data: {
        id: savedInvoiceId,
        invoice_number: invoiceNumber,
        paypal_invoice_id: paypalResult.paypalInvoiceId,
        payer_view_url: paypalResult.payerLink,
        status: "sent",
        bill_to: draft.clientName,
        send_to: draft.sendTo,
        currency: draft.currency,
        total,
        invoice_date: draft.invoiceDate,
        due_date: dueDate,
        ai_review: assessment.aiReview,
        preflight: {
          blockers: 0,
          warnings: assessment.warnings.length,
        },
      },
    });
  } catch (error: any) {
    console.error("[invoiceController] generateInvoice error:", error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: {
        code: error.code || "PAYPAL_ERROR",
        message: error.message || "Failed to generate and send invoice.",
        details: { debugId: error.debugId },
      },
    });
  }
}

/**
 * GET /api/invoices
 * Lists all invoices from the database with KPI counts.
 */
export async function listInvoices(_req: Request, res: Response) {
  try {
    const { data: invoices, error } = await db
      .from("invoices")
      .select("*, invoice_items(*)")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const today = new Date().toISOString().slice(0, 10);
    const processed = (invoices || []).map((inv: any) => {
      // DB-04: overdue is derived at read-time
      const isOverdue = inv.status === "sent" && inv.due_date < today;
      return {
        id: inv.id,
        number: inv.invoice_number,
        clientName: inv.bill_to,
        amount: Number(inv.total),
        currency: inv.currency,
        status: isOverdue ? "overdue" : inv.status,
        issueDate: inv.invoice_date,
        dueDate: inv.due_date,
        preflight: inv.preflight_summary || { blockers: 0, warnings: 0 },
        paypalInvoiceId: inv.paypal_invoice_id,
        payerLink: inv.payer_view_url,
        payer_view_url: inv.payer_view_url,
        updatedNote: inv.status === "paid" ? "Paid" : "Sent",
        items: inv.invoice_items || [],
      };
    });

    return res.json({ invoices: processed });
  } catch (error: any) {
    console.error("[invoiceController] listInvoices error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL",
        message: error.message || "Failed to retrieve invoices.",
      },
    });
  }
}

/**
 * GET /api/invoices/:id
 */
export async function getInvoiceById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { data, error } = await db
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: `Invoice ${id} not found.` },
      });
    }

    return res.json({ invoice: data });
  } catch (error: any) {
    return res.status(500).json({
      error: { code: "INTERNAL", message: error.message },
    });
  }
}

/**
 * POST /api/invoices/:id/mark-paid
 */
export async function markInvoicePaid(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = db
      .from("invoices")
      .update({ status: "paid", updated_via: "app", updated_at: new Date().toISOString() });

    if (isUuid) {
      query = query.eq("id", id);
    } else {
      query = query.or(`invoice_number.eq.${id},paypal_invoice_id.eq.${id}`);
    }

    const { data, error } = await query.select().single();

    if (error) {
      throw error;
    }

    return res.json({ success: true, invoice: data });
  } catch (error: any) {
    return res.status(500).json({
      error: { code: "INTERNAL", message: error.message },
    });
  }
}

export default {
  generateInvoice,
  listInvoices,
  getInvoiceById,
  markInvoicePaid,
};
