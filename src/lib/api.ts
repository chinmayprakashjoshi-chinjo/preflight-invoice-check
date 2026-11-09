/**
 * Data access layer. Components talk to the backend through these functions only.
 *
 * VITE_USE_MOCKS (default true) returns mock data after a short delay.
 * Set VITE_USE_MOCKS=false and VITE_API_BASE_URL to call the real endpoints with fetch;
 * responses are validated with the same Zod schemas, so components never change.
 *
 *   extractRequirements  POST /api/requirements
 *   draftInvoice         POST /api/draft
 *   runPreflight         POST /api/preflight
 *   calcPricing          POST /api/pricer
 *   sendInvoice          POST /api/send
 *   listInvoices         GET  /api/invoices
 *   markPaid             POST /api/invoices/:id/mark-paid
 */
import { z } from "zod";
import { getExtractedRequirements, MOCK_CLIENTS } from "@/mocks/clients";
import { seedInvoices } from "@/mocks/invoices";
import { dueDateFor, invoiceTotal, todayIso } from "./format";
import { parseDraftPrompt } from "./parse-draft";
import { preflight, summarize } from "./preflight";
import { calcPricing as calcPricingPure } from "./pricer";
import {
  ClientSchema,
  InvoiceRecordSchema,
  IssueSchema,
  ParsedDraftSchema,
  PricingResultSchema,
  type Client,
  type ClientRequirements,
  type DraftInvoice,
  type ExtractInput,
  type InvoiceRecord,
  type Issue,
  type LearnInput,
  type ParsedDraft,
  type PricingInput,
  type PricingResult,
  type RequirementKey,
} from "./types";

export const API_BASE_URL: string = import.meta.env["VITE_API_BASE_URL"] ?? "";
export const USE_MOCKS: boolean = import.meta.env["VITE_USE_MOCKS"] !== "false";

export class ApiError extends Error {}

const delay = (ms: number) =>
  USE_MOCKS ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
const clone = <T>(v: T): T => structuredClone(v);

async function request<S extends z.ZodTypeAny>(
  method: "GET" | "POST" | "PUT",
  path: string,
  schema: S,
  body?: unknown,
): Promise<z.infer<S>> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) throw new ApiError(`Request failed (${res.status}).`);
  return schema.parse(await res.json());
}

/* ---------- Mock database (this browser session only) ---------- */

function freshDb() {
  return { clients: clone(MOCK_CLIENTS), invoices: seedInvoices(), nextInvoiceNumber: 108 };
}
let db = freshDb();

/** Restores the seed state so the demo can be recorded repeatedly. */
export async function resetDemoData(): Promise<void> {
  db = freshDb();
}

/** Overdue is derived: a sent invoice past its due date. */
function withDerivedStatus(inv: InvoiceRecord): InvoiceRecord {
  if (inv.status === "sent" && inv.dueDate < todayIso()) return { ...inv, status: "overdue" };
  return inv;
}

/* ---------- Clients ---------- */

export async function getClients(): Promise<Client[]> {
  if (!USE_MOCKS) return request("GET", "/api/clients", z.array(ClientSchema));
  await delay(350);
  return clone(db.clients);
}

/**
 * Reads the client's AP document (uploaded PDF or pasted text) into structured requirements.
 * Mock: demo clients always extract. Only a non-PDF file or empty input is "unreadable".
 */
export async function extractRequirements(input: ExtractInput): Promise<Client> {
  if (!USE_MOCKS) return request("POST", "/api/requirements", ClientSchema, input);
  await delay(1500);
  const client = db.clients.find((c) => c.id === input.clientId);
  if (!client) throw new ApiError("Client not found.");
  const hasText = Boolean(input.text?.trim());
  const badFile = input.fileName !== undefined && !/\.pdf$/i.test(input.fileName);
  if (badFile || (!hasText && !input.fileName)) {
    client.docStatus = "error";
    client.docError = badFile
      ? "That file is not a PDF."
      : "There was no text to read in that input.";
    client.requirements = null;
    return clone(client);
  }
  const extracted = getExtractedRequirements(input.clientId);
  if (!extracted) throw new ApiError("Could not read the AP document.");
  client.requirements = clone(extracted);
  client.docStatus = "extracted";
  client.docError = undefined;
  if (input.fileName) client.sourceDoc = { ...client.sourceDoc, fileName: input.fileName };
  return clone(client);
}

export async function updateRequirements(
  clientId: string,
  requirements: ClientRequirements,
): Promise<Client> {
  if (!USE_MOCKS)
    return request("PUT", `/api/clients/${clientId}/requirements`, ClientSchema, requirements);
  await delay(250);
  const client = db.clients.find((c) => c.id === clientId);
  if (!client) throw new ApiError("Client not found.");
  client.requirements = clone(requirements);
  return clone(client);
}

/** Splits an email into sentences and returns the first one matching the pattern. */
function quoteFor(text: string, pattern: RegExp): string | null {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
  return sentences.find((s) => pattern.test(s))?.trim() ?? null;
}

const LEARN_RULES: { key: RequirementKey; pattern: RegExp }[] = [
  { key: "poRequired", pattern: /\bPO\b|purchase order/i },
  { key: "legalName", pattern: /legal (entity|name)|registered name|exactly as/i },
  { key: "vatRequired", pattern: /\bVAT\b|tax (id|identification)/i },
  { key: "allowedCurrencies", pattern: /\b(EUR|USD)\b|currency|euro|dollar/i },
  { key: "paymentTerms", pattern: /net\s?\d+|within \d+ days|payment terms/i },
  { key: "apEmail", pattern: /\S+@\S+\.\S+/ },
];

/** Mock "Learn from this email": adds or updates one requirement with a quote from the email. */
export async function learnFromEmail(input: LearnInput): Promise<Client> {
  if (!USE_MOCKS) return request("POST", "/api/requirements/learn", ClientSchema, input);
  await delay(900);
  const client = db.clients.find((c) => c.id === input.clientId);
  if (!client?.requirements) throw new ApiError("Extract this client's requirements first.");
  const req = clone(client.requirements);
  const hits = LEARN_RULES.map((r) => ({ ...r, quote: quoteFor(input.text, r.pattern) })).filter(
    (r) => r.quote,
  );
  // Prefer a requirement the client does not have yet, so a new row appears.
  const hit = hits.find((h) => !req.meta[h.key]) ?? hits[0];
  if (!hit?.quote) throw new ApiError("Could not find a rule in that email.");
  const quote = hit.quote;
  switch (hit.key) {
    case "poRequired":
      req.poRequired = true;
      break;
    case "vatRequired":
      req.vatRequired = true;
      break;
    case "legalName": {
      const m = quote.match(/["“]([^"”]+)["”]/);
      req.legalName = m?.[1] ?? req.legalName ?? client.name;
      break;
    }
    case "allowedCurrencies": {
      const found = (["USD", "EUR"] as const).filter((c) =>
        new RegExp(`\\b${c}\\b`, "i").test(quote),
      );
      if (found.length) req.allowedCurrencies = found;
      break;
    }
    case "paymentTerms": {
      const n = quote.match(/(\d+)/)?.[1];
      const terms = n === "15" ? "Net 15" : n === "45" ? "Net 45" : "Net 30";
      req.paymentTerms = terms;
      break;
    }
    case "apEmail":
      req.apEmail = quote.match(/\S+@[^\s,;)]+/)?.[0].replace(/[.]$/, "") ?? req.apEmail;
      break;
  }
  req.meta[hit.key] = { evidence: quote, confidence: "high", isNew: true };
  client.requirements = req;
  return clone(client);
}

/* ---------- Draft ---------- */

/** Turns a one-line description into draft fields. */
export async function draftInvoice(text: string): Promise<ParsedDraft> {
  if (!USE_MOCKS) return request("POST", "/api/draft", ParsedDraftSchema, { text });
  await delay(600);
  return parseDraftPrompt(text, db.clients);
}

/* ---------- Pre-flight ---------- */

/** Runs the pre-flight rules for the client. Mock uses the local pure function. */
export async function runPreflight(invoice: DraftInvoice, clientId: string): Promise<Issue[]> {
  if (!USE_MOCKS)
    return request("POST", "/api/preflight", z.array(IssueSchema), { invoice, clientId });
  const requirements = db.clients.find((c) => c.id === clientId)?.requirements;
  if (!requirements) throw new ApiError("This client has no AP requirements yet.");
  return preflight(invoice, requirements);
}

/* ---------- Pricer ---------- */

export async function calcPricing(input: PricingInput): Promise<PricingResult> {
  if (!USE_MOCKS) return request("POST", "/api/pricer", PricingResultSchema, input);
  return calcPricingPure(input);
}

/* ---------- Invoices ---------- */

export async function listInvoices(): Promise<InvoiceRecord[]> {
  if (!USE_MOCKS) return request("GET", "/api/invoices", z.array(InvoiceRecordSchema));
  await delay(400);
  return clone(db.invoices).map(withDerivedStatus);
}

function randomBlock(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Sends the invoice through PayPal (sandbox). Mock: records it as Sent with a fake PayPal ID. */
export async function sendInvoice(invoice: DraftInvoice, issues: Issue[]): Promise<InvoiceRecord> {
  if (!USE_MOCKS) return request("POST", "/api/send", InvoiceRecordSchema, { invoice, issues });
  await delay(1200);
  const { blockers, warnings } = summarize(issues);
  if (blockers > 0) throw new ApiError("Resolve all blockers before sending.");
  const paypalInvoiceId = `INV2-${randomBlock()}-${randomBlock()}-${randomBlock()}-${randomBlock()}`;
  const record: InvoiceRecord = {
    id: `inv-${Date.now()}`,
    number: `INV-2026-${String(db.nextInvoiceNumber++).padStart(4, "0")}`,
    clientName: invoice.clientName,
    amount: invoiceTotal(invoice),
    currency: invoice.currency,
    status: "sent",
    issueDate: invoice.invoiceDate,
    dueDate: dueDateFor(invoice),
    preflight: { blockers, warnings },
    paypalInvoiceId,
    payerLink: `https://www.sandbox.paypal.com/invoice/p/#${paypalInvoiceId}`,
    updatedNote: "Sent",
  };
  db.invoices.unshift(record);
  return clone(record);
}

/** Simulates the PayPal INVOICING.INVOICE.PAID webhook. */
export async function markPaid(invoiceId: string): Promise<InvoiceRecord> {
  if (!USE_MOCKS)
    return request("POST", `/api/invoices/${invoiceId}/mark-paid`, InvoiceRecordSchema);
  await delay(700);
  const inv = db.invoices.find((i) => i.id === invoiceId);
  if (!inv) throw new ApiError("Invoice not found.");
  if (inv.status !== "sent")
    throw new ApiError("Only sent or overdue invoices can be marked paid.");
  inv.status = "paid";
  inv.updatedNote = "Paid via webhook, just now";
  return clone(inv);
}
