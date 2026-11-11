import { Router, Request, Response } from "express";
import { db } from "../../lib/db.js";
import { verifyWebhookSignature } from "../services/paypalService.js";

export const webhooksRouter = Router();

/**
 * POST /api/webhooks/paypal
 * Handles incoming PayPal webhook notifications:
 * 1. Verifies PayPal webhook signature using raw body (API-13, PRD Section 11.4 & Hard Rule 8).
 * 2. Deduplicates events by event_id against the webhook_events table in Supabase (DB-03).
 * 3. Handles INVOICING.INVOICE.PAID to update invoice status to 'paid' (with updated_via = 'webhook').
 * 4. Handles INVOICING.INVOICE.SENT to update invoice status to 'sent'.
 * 5. Responds fast with 200 OK.
 */
webhooksRouter.post("/paypal", async (req: Request, res: Response) => {
  try {
    // Read raw body for authoritative signature verification per Hard Rule 8
    const rawBody = (req as any).rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    const event = typeof req.body === "object" && req.body !== null ? req.body : JSON.parse(rawBody || "{}");

    if (!event || typeof event !== "object" || !event.id) {
      return res.status(400).json({
        error: {
          code: "INVALID_PAYLOAD",
          message: "Missing or invalid PayPal webhook event payload.",
        },
      });
    }

    const eventId: string = event.id;
    const eventType: string = event.event_type || "UNKNOWN";
    const paypalInvoiceId: string | null =
      event.resource?.id || event.resource?.invoice?.id || null;
    const invoiceNumber: string | null =
      event.resource?.invoice_number ||
      event.resource?.detail?.invoice_number ||
      null;

    console.log(`[webhooks] Received PayPal webhook event: ${eventType} (ID: ${eventId})`);

    // 1. Verify Webhook Signature
    const hasSigHeaders = Boolean(
      req.headers["paypal-auth-algo"] || req.headers["PAYPAL-AUTH-ALGO"],
    );
    let isVerified = false;

    if (hasSigHeaders) {
      isVerified = await verifyWebhookSignature(req.headers, event);
      if (!isVerified) {
        if (process.env.DEMO_MODE !== "true") {
          console.warn(`[webhooks] Rejected webhook ${eventId}: Signature verification failed.`);
          return res.status(400).json({
            error: {
              code: "INVALID_SIGNATURE",
              message: "PayPal webhook signature verification failed.",
            },
          });
        }
        console.warn(`[webhooks] DEMO_MODE active: Processing unverified webhook event ${eventId}.`);
      }
    } else {
      if (process.env.DEMO_MODE !== "true") {
        console.warn(`[webhooks] Missing PayPal signature headers for event ${eventId}.`);
        return res.status(400).json({
          error: {
            code: "MISSING_HEADERS",
            message: "Missing PayPal signature headers in webhook request.",
          },
        });
      }
      console.warn(`[webhooks] DEMO_MODE active: Allowing simulated webhook event ${eventId} without signature headers.`);
    }

    // 2. Deduplicate: Check if event_id has already been processed
    const { data: existingEvent, error: checkError } = await db
      .from("webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (checkError) {
      console.warn(`[webhooks] Error checking idempotency for event ${eventId}:`, checkError);
    }

    if (existingEvent) {
      console.log(`[webhooks] Event ${eventId} already processed (idempotent duplicate). Ignoring.`);
      return res.status(200).json({
        status: "duplicate_ignored",
        event_id: eventId,
      });
    }

    // 3. Save event to webhook_events table in Supabase
    const { error: insertError } = await db.from("webhook_events").insert({
      event_id: eventId,
      event_type: eventType,
      paypal_invoice_id: paypalInvoiceId,
      payload: event,
      verified: isVerified,
      processed_at: new Date().toISOString(),
    });

    if (insertError) {
      // PostgreSQL code 23505 = unique_violation (concurrent duplicate)
      if (insertError.code === "23505") {
        console.log(`[webhooks] Concurrent duplicate for event ${eventId}. Returning 200.`);
        return res.status(200).json({
          status: "duplicate_ignored",
          event_id: eventId,
        });
      }
      console.error(`[webhooks] Error recording webhook_events for ${eventId}:`, insertError);
    }

    // 4. Process event actions
    if (eventType === "INVOICING.INVOICE.PAID") {
      let updateQuery = db
        .from("invoices")
        .update({
          status: "paid",
          updated_via: "webhook",
          updated_at: new Date().toISOString(),
        });

      if (paypalInvoiceId) {
        updateQuery = updateQuery.eq("paypal_invoice_id", paypalInvoiceId);
      } else if (invoiceNumber) {
        updateQuery = updateQuery.eq("invoice_number", invoiceNumber);
      } else {
        console.warn(`[webhooks] INVOICING.INVOICE.PAID event ${eventId} has no invoice reference.`);
      }

      if (paypalInvoiceId || invoiceNumber) {
        const { data: updated, error: updateError } = await updateQuery.select();
        if (updateError) {
          console.error(`[webhooks] Error updating invoice to paid:`, updateError);
        } else {
          console.log(
            `[webhooks] Marked invoice paid via webhook:`,
            updated?.map((inv: any) => `${inv.invoice_number} (${inv.paypal_invoice_id})`),
          );
        }
      }
    } else if (eventType === "INVOICING.INVOICE.SENT") {
      let updateQuery = db
        .from("invoices")
        .update({
          status: "sent",
          updated_via: "webhook",
          updated_at: new Date().toISOString(),
        });

      if (paypalInvoiceId) {
        updateQuery = updateQuery.eq("paypal_invoice_id", paypalInvoiceId);
      } else if (invoiceNumber) {
        updateQuery = updateQuery.eq("invoice_number", invoiceNumber);
      }

      if (paypalInvoiceId || invoiceNumber) {
        const { data: updated, error: updateError } = await updateQuery.select();
        if (updateError) {
          console.error(`[webhooks] Error updating invoice to sent:`, updateError);
        } else {
          console.log(
            `[webhooks] Verified invoice sent via webhook:`,
            updated?.map((inv: any) => `${inv.invoice_number} (${inv.paypal_invoice_id})`),
          );
        }
      }
    } else {
      console.log(`[webhooks] Event type '${eventType}' recorded and ignored.`);
    }

    // 5. Respond fast with 200 OK
    return res.status(200).json({
      status: "ok",
      event_id: eventId,
      event_type: eventType,
    });
  } catch (error: any) {
    console.error("[webhooks] Uncaught error handling webhook:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL",
        message: error.message || "Failed to process webhook event.",
      },
    });
  }
});

export default webhooksRouter;
