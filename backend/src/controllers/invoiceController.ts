import { Request, Response } from "express";
import { db } from "../../lib/db.js";
import { resolveClient } from "./clientController.js";
import {
  createAndSendInvoice,
  recordInvoicePayment,
  getInvoice,
} from "../services/paypalService.js";
import { validateInvoiceWithAICoPilot } from "../services/aiService.js";
import { dueDateFor, termsToDays } from "../../../shared/format.js";
import type {
  DraftInvoice,
  LineItem,
  Currency,
  PaymentTerms,
  ClientRequirements,
  InvoiceRecord,
  InvoiceStatus,
} from "../../../shared/types.js";

// Fast in-memory idempotency cache fallback
const idempotencyCache = new Map<string, InvoiceRecord>();

/**
 * Normalizes input from frontend into a typed DraftInvoice structure.
 * Supports both raw DraftInvoice objects and { invoice, issues } wrapped payloads.
 */
function normalizeInvoiceInput(rawBody: any): DraftInvoice {
  const body = rawBody?.invoice || rawBody || {};
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
 * Generates sequential invoice number using next_invoice_number() (INV-<year>-<4 digits>).
 */
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const { data, error } = await db.rpc("next_invoice_number", { target_year: year });
    if (!error && data) {
      return String(data);
    }
  } catch (err: any) {
    console.warn("[invoiceController] next_invoice_number RPC failed:", err.message || err);
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

  return `INV-${year}-0001`;
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
    const rawIdempotency =
      req.get("Idempotency-Key") ||
      req.get("x-idempotency-key") ||
      (req.headers["idempotency-key"] as string) ||
      (req.headers["x-idempotency-key"] as string) ||
      req.body?.idempotencyKey ||
      req.body?.invoice?.idempotencyKey;
    const idempotencyKey = typeof rawIdempotency === "string" ? rawIdempotency.trim() : null;

    if (idempotencyKey) {
      if (idempotencyCache.has(idempotencyKey)) {
        console.log(`[invoiceController] Idempotency memory cache hit: ${idempotencyKey}`);
        return res.status(200).json(idempotencyCache.get(idempotencyKey));
      }

      try {
        let existing: any = null;

        // Query unique idempotency_key column in invoices table
        const { data: colRows, error: colErr } = await db
          .from("invoices")
          .select("*")
          .eq("idempotency_key", idempotencyKey)
          .limit(1);

        if (!colErr && colRows && colRows.length > 0) {
          existing = colRows[0];
        } else {
          // Fallback to preflight_summary JSON query if column does not yet exist
          const { data: jsonRows } = await db
            .from("invoices")
            .select("*")
            .filter("preflight_summary->>idempotencyKey", "eq", idempotencyKey)
            .limit(1);
          if (jsonRows && jsonRows.length > 0) {
            existing = jsonRows[0];
          }
        }

        if (existing) {
          const cachedRecord: InvoiceRecord = {
            id: existing.id,
            number: existing.invoice_number,
            clientName: existing.bill_to,
            amount: Number(existing.total),
            currency: existing.currency,
            status: existing.status,
            issueDate: existing.invoice_date,
            dueDate: existing.due_date,
            preflight: {
              blockers: existing.preflight_summary?.blockers || 0,
              warnings: existing.preflight_summary?.warnings || 0,
            },
            paypalInvoiceId: existing.paypal_invoice_id,
            payerLink: existing.payer_view_url,
            updatedNote: existing.status === "paid" ? "Paid" : existing.status === "draft" ? "Draft saved" : "Sent",
          };
          idempotencyCache.set(idempotencyKey, cachedRecord);
          console.log(`[invoiceController] Idempotency DB hit: ${idempotencyKey}`);
          return res.status(200).json(cachedRecord);
        }
      } catch (err: any) {
        console.warn("[invoiceController] Idempotency query warning:", err.message || err);
      }
    }

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
    const isUuid = clientId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId);
    try {
      const invoiceInsertData: any = {
        invoice_number: invoiceNumber,
        client_id: isUuid ? clientId : null,
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
        idempotency_key: idempotencyKey || null,
        preflight_summary: {
          blockers: 0,
          warnings: assessment.warnings.length,
          passed: assessment.passed.length,
          aiReview: assessment.aiReview,
          idempotencyKey: idempotencyKey || null,
        },
        updated_via: "app",
      };

      let { data: invRow, error: invError } = await db
        .from("invoices")
        .insert(invoiceInsertData)
        .select("id")
        .single();

      // Gracefully fall back if idempotency_key column migration hasn't been run yet
      if (invError && invError.message?.includes("idempotency_key")) {
        delete invoiceInsertData.idempotency_key;
        const fallback = await db
          .from("invoices")
          .insert(invoiceInsertData)
          .select("id")
          .single();
        invRow = fallback.data;
        invError = fallback.error;
      }

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

    // Return flat InvoiceRecord matching frontend InvoiceRecordSchema exactly
    const record: InvoiceRecord = {
      id: String(savedInvoiceId || paypalResult.paypalInvoiceId || invoiceNumber),
      number: invoiceNumber,
      clientName: draft.clientName,
      amount: total,
      currency: draft.currency,
      status: "sent",
      issueDate: draft.invoiceDate,
      dueDate: dueDate,
      preflight: {
        blockers: 0,
        warnings: assessment.warnings.length,
      },
      paypalInvoiceId: paypalResult.paypalInvoiceId,
      payerLink: paypalResult.payerLink,
      updatedNote: "Sent",
    };

    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, record);
    }

    console.log(`[invoiceController] ✓ Successfully dispatched invoice ${invoiceNumber} to PayPal Sandbox.`);
    return res.status(201).json(record);
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
 * Supports ?refresh=true active polling fallback (FR-10 & PRD Section 11.6).
 */
export async function listInvoices(req: Request, res: Response) {
  try {
    const shouldRefresh = req.query.refresh === "true" || req.query.refresh === "1";

    // FR-10: Active polling fallback for stale non-paid invoices in PayPal
    if (shouldRefresh) {
      console.log("[invoiceController] Active polling triggered (?refresh=true)...");
      try {
        const { data: pendingInvoices } = await db
          .from("invoices")
          .select("id, invoice_number, paypal_invoice_id, status")
          .eq("status", "sent")
          .not("paypal_invoice_id", "is", null)
          .limit(20);

        if (pendingInvoices && pendingInvoices.length > 0) {
          // Filter to real PayPal invoices (e.g. not starting with dummy SEED-)
          const checkable = pendingInvoices.filter(
            (inv: any) => inv.paypal_invoice_id && !inv.paypal_invoice_id.startsWith("SEED-"),
          );

          await Promise.allSettled(
            checkable.map(async (inv: any) => {
              try {
                const paypal = await getInvoice(inv.paypal_invoice_id);
                const paypalStatus = (paypal.status || "").toUpperCase();

                if (paypalStatus === "PAID" || paypalStatus === "MARKED_AS_PAID") {
                  console.log(
                    `[invoiceController] Polling discovered invoice ${inv.invoice_number} is PAID on PayPal. Syncing to DB...`,
                  );
                  await db
                    .from("invoices")
                    .update({
                      status: "paid",
                      updated_via: "poll",
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", inv.id);
                } else if (paypalStatus === "CANCELLED") {
                  await db
                    .from("invoices")
                    .update({
                      status: "draft",
                      updated_via: "poll",
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", inv.id);
                }
              } catch (err: any) {
                console.warn(
                  `[invoiceController] Polling check failed for ${inv.paypal_invoice_id}:`,
                  err.message || err,
                );
              }
            }),
          );
        }
      } catch (pollErr: any) {
        console.warn("[invoiceController] Polling fallback batch error:", pollErr.message || pollErr);
      }
    }

    const { data: invoices, error } = await db
      .from("invoices")
      .select("*, invoice_items(*)")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const today = new Date().toISOString().slice(0, 10);
    const processed: InvoiceRecord[] = (invoices || []).map((inv: any) => {
      // DB-04: overdue is derived at read-time
      const isOverdue = inv.status === "sent" && inv.due_date < today;
      return {
        id: String(inv.id),
        number: inv.invoice_number,
        clientName: inv.bill_to,
        amount: Number(inv.total),
        currency: inv.currency as Currency,
        status: isOverdue ? "overdue" : (inv.status as InvoiceStatus),
        issueDate: inv.invoice_date,
        dueDate: inv.due_date,
        preflight: inv.preflight_summary || { blockers: 0, warnings: 0 },
        paypalInvoiceId: inv.paypal_invoice_id || undefined,
        payerLink: inv.payer_view_url || undefined,
        updatedNote: inv.status === "paid" ? "Paid" : inv.status === "draft" ? "Draft saved" : "Sent",
      };
    });

    return res.json(processed);
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
 * API-11: Retrieves invoice details and attached webhook events.
 */
export async function getInvoiceById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = db.from("invoices").select("*, invoice_items(*)");
    if (isUuid) {
      query = query.eq("id", id);
    } else {
      query = query.or(`invoice_number.eq.${id},paypal_invoice_id.eq.${id}`);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: `Invoice ${id} not found.` },
      });
    }

    // Load related webhook events per PRD Section 10 API-11
    let events: any[] = [];
    if (data.paypal_invoice_id) {
      const { data: evData } = await db
        .from("webhook_events")
        .select("*")
        .eq("paypal_invoice_id", data.paypal_invoice_id)
        .order("received_at", { ascending: false });
      if (evData) events = evData;
    }

    return res.json({ invoice: data, events });
  } catch (error: any) {
    return res.status(500).json({
      error: { code: "INTERNAL", message: error.message },
    });
  }
}

/**
 * POST /api/invoices/:id/mark-paid
 * - Locates invoice in Supabase
 * - If paypal_invoice_id exists, records payment via PayPal Sandbox API (POST /v2/invoicing/invoices/{id}/payments)
 * - Updates Supabase status to 'paid' with updated_via = 'app'
 * - Returns formatted InvoiceRecord
 */
export async function markInvoicePaid(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let lookupQuery = db.from("invoices").select("*");
    if (isUuid) {
      lookupQuery = lookupQuery.eq("id", id);
    } else {
      lookupQuery = lookupQuery.or(`invoice_number.eq.${id},paypal_invoice_id.eq.${id}`);
    }

    const { data: existing, error: lookupError } = await lookupQuery.maybeSingle();

    if (lookupError || !existing) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: `Invoice '${id}' not found.` },
      });
    }

    // Hit PayPal Sandbox API to record external payment per PRD Section 11.5
    if (existing.paypal_invoice_id) {
      try {
        console.log(`[invoiceController] Recording payment in PayPal Sandbox for ${existing.paypal_invoice_id}...`);
        await recordInvoicePayment(existing.paypal_invoice_id, {
          method: "BANK_TRANSFER",
          paymentDate: new Date().toISOString().slice(0, 10),
          amount: {
            currency: existing.currency,
            value: existing.total,
          },
          note: "Payment recorded via PreFlight (Sandbox)",
        });
        console.log(`[invoiceController] PayPal Sandbox payment successfully recorded for ${existing.paypal_invoice_id}`);
      } catch (payPalErr: any) {
        console.warn(
          `[invoiceController] PayPal record payment notice for ${existing.paypal_invoice_id}: ${payPalErr.message || payPalErr}`,
        );
        // Continue to update local DB even if PayPal reports already paid
      }
    }

    const { data, error } = await db
      .from("invoices")
      .update({
        status: "paid",
        updated_via: "app",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error || !data) {
      throw error || new Error(`Failed to update invoice '${id}' status to paid.`);
    }

    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = data.status === "sent" && data.due_date < today;
    const record: InvoiceRecord = {
      id: String(data.id),
      number: data.invoice_number,
      clientName: data.bill_to,
      amount: Number(data.total),
      currency: data.currency as Currency,
      status: isOverdue ? "overdue" : (data.status as InvoiceStatus),
      issueDate: data.invoice_date,
      dueDate: data.due_date,
      preflight: data.preflight_summary || { blockers: 0, warnings: 0 },
      paypalInvoiceId: data.paypal_invoice_id || undefined,
      payerLink: data.payer_view_url || undefined,
      updatedNote: "Paid via sandbox",
    };

    return res.json(record);
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
