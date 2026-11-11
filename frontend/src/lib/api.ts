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
  type Currency,
  type DraftInvoice,
  type ExtractInput,
  type InvoiceRecord,
  type InvoiceStatus,
  type Issue,
  type LearnInput,
  type ParsedDraft,
  type PricingInput,
  type PricingResult,
  type RequirementKey,
} from "./types";

/**
 * Resolves the API Base URL.
 * In production mode (e.g. monolithic deployment where frontend is served by backend),
 * defaults to '' (relative path) so requests go directly to same-origin /api/...
 * In development, defaults to 'http://localhost:8000' unless overridden by VITE_API_BASE_URL.
 */
export function getApiBaseUrl(): string {
  const envBase = import.meta.env["VITE_API_BASE_URL"];
  if (envBase !== undefined && envBase !== "") {
    return envBase.replace(/\/+$/, "");
  }

  const isProduction =
    import.meta.env.PROD ||
    import.meta.env.MODE === "production" ||
    (typeof process !== "undefined" && process.env?.NODE_ENV === "production");

  if (isProduction) {
    return "";
  }

  return "http://localhost:8000";
}

export const API_BASE_URL: string = getApiBaseUrl();
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

/* ---------- Mock database (persisted per browser session) ---------- */

const DB_STORAGE_KEY = "preflight_demo_db_v1";

function freshDb() {
  return { clients: clone(MOCK_CLIENTS), invoices: seedInvoices(), nextInvoiceNumber: 108 };
}

function loadDb(): ReturnType<typeof freshDb> {
  if (typeof window !== "undefined") {
    try {
      const saved = sessionStorage.getItem(DB_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.invoices) && parsed.invoices.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  return freshDb();
}

function saveDb(data: ReturnType<typeof freshDb>): void {
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(DB_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }
}

let db = loadDb();

/** Restores the seed state so the demo can be recorded repeatedly. */
export async function resetDemoData(): Promise<void> {
  const backendBase = API_BASE_URL;
  try {
    await fetch(`${backendBase}/api/dev/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.warn("[api] Could not reset backend dev data:", err);
  }
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(DB_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  db = freshDb();
}

/** Overdue is derived: a sent invoice past its due date. */
function withDerivedStatus(inv: InvoiceRecord): InvoiceRecord {
  if (inv.status === "sent" && inv.dueDate < todayIso()) return { ...inv, status: "overdue" };
  return inv;
}

/* ---------- Clients ---------- */

export async function getClients(): Promise<Client[]> {
  const backendBase = API_BASE_URL;
  try {
    const res = await fetch(`${backendBase}/api/clients`);
    if (res.ok) {
      const data = await res.json();
      const parsed = z.array(ClientSchema).safeParse(data);
      if (parsed.success && parsed.data.length > 0) {
        db.clients = clone(parsed.data);
        return parsed.data;
      }
    }
  } catch (err) {
    console.warn("[api] Could not fetch live clients, using local mock data:", err);
  }

  await delay(150);
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
  ruleKey?: string,
): Promise<Client> {
  const backendBase = API_BASE_URL;

  // 1. ALWAYS dispatch PUT to backend server to update Supabase in real-time
  try {
    const putRes = await fetch(`${backendBase}/api/clients/${clientId}/requirements`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requirements),
    });

    // 2. Also fire PATCH to specific rule endpoint if ruleKey is provided
    if (ruleKey && requirements[ruleKey as keyof ClientRequirements] !== undefined) {
      await fetch(`${backendBase}/api/clients/${clientId}/rules/${ruleKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: requirements[ruleKey as keyof ClientRequirements] }),
      }).catch(() => {});
    }

    if (putRes.ok) {
      const data = await putRes.json();
      const parsed = ClientSchema.safeParse(data);
      if (parsed.success) {
        const local = db.clients.find(
          (c) => c.id === clientId || c.name.toLowerCase().includes(clientId.toLowerCase()),
        );
        if (local) {
          local.requirements = clone(parsed.data.requirements || requirements);
        }
        return parsed.data;
      }
    }
  } catch (err) {
    console.warn("[api] Could not persist requirement update to backend:", err);
  }

  // Fallback to local memory update
  await delay(250);
  const client = db.clients.find(
    (c) => c.id === clientId || c.name.toLowerCase().includes(clientId.toLowerCase()),
  );
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

/** Turns a one-line description into draft fields, preserving existing total amount if present. */
export async function draftInvoice(
  text: string,
  existingAmount?: number,
  existingCurrency?: Currency,
): Promise<ParsedDraft> {
  const instructedText =
    existingAmount && existingAmount > 0
      ? `${text} (Note: KEEP the existing total amount of ${existingAmount} ${existingCurrency ?? ""}. ONLY generate the description, client name, and other missing details, ignoring any amount mentioned in the user's text prompt.)`
      : text;

  const backendBase = API_BASE_URL;
  try {
    const res = await fetch(`${backendBase}/api/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: instructedText,
        existingAmount: existingAmount && existingAmount > 0 ? existingAmount : undefined,
        existingCurrency,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const parsed = ParsedDraftSchema.safeParse(data);
      if (parsed.success) {
        if (existingAmount && existingAmount > 0) {
          parsed.data.amount = existingAmount;
          if (existingCurrency) parsed.data.currency = existingCurrency;
        }
        return parsed.data;
      }
    }
  } catch (err) {
    console.warn("[api] Live draft endpoint failed or offline, falling back to local parser:", err);
  }

  await delay(300);
  return parseDraftPrompt(instructedText, db.clients, existingAmount, existingCurrency);
}

/* ---------- Pre-flight ---------- */

/** Runs the pre-flight rules for the client. Fast-fails to pure client rules to prevent hanging. */
export async function runPreflight(invoice: DraftInvoice, clientId: string): Promise<Issue[]> {
  const requirements =
    db.clients.find((c) => c.id === clientId)?.requirements ??
    getExtractedRequirements(clientId) ??
    MOCK_CLIENTS.find((c) => c.id === clientId)?.requirements;

  const localIssues = requirements ? preflight(invoice, requirements) : [];

  const backendBase = API_BASE_URL;
  try {
    const res = await fetch(`${backendBase}/api/preflight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(2000),
      body: JSON.stringify({ invoice, clientId }),
    });
    if (res.ok) {
      const data = await res.json();
      const rawIssues = Array.isArray(data) ? data : data.issues;
      if (Array.isArray(rawIssues) && rawIssues.length > 0) {
        return rawIssues;
      }
    }
  } catch (err) {
    console.warn("[api] Live preflight failed or timed out, using local AP rules:", err);
  }

  return localIssues;
}

/* ---------- Pricer ---------- */

export async function calcPricing(input: PricingInput): Promise<PricingResult> {
  if (!USE_MOCKS) return request("POST", "/api/pricer", PricingResultSchema, input);
  return calcPricingPure(input);
}

/* ---------- Invoices ---------- */

export function recordCreatedInvoice(record: InvoiceRecord): void {
  const existingIdx = db.invoices.findIndex(
    (i) => i.id === record.id || (i.number && i.number === record.number),
  );
  if (existingIdx >= 0) {
    db.invoices[existingIdx] = record;
  } else {
    db.invoices.unshift(record);
  }
  saveDb(db);
}

export async function listInvoices(): Promise<InvoiceRecord[]> {
  const backendBase = API_BASE_URL;
  try {
    const res = await fetch(`${backendBase}/api/invoices`);
    if (res.ok) {
      const data = await res.json();
      const rawInvoices: Array<Record<string, unknown>> = Array.isArray(data)
        ? data
        : data.invoices || [];
      const today = todayIso();
      const mapped: InvoiceRecord[] = rawInvoices.map((inv) => {
        const isOverdue = inv.status === "sent" && (inv.dueDate || inv.due_date) < today;
        return {
          id: String(inv.id || inv.invoice_number || inv.number),
          number: (inv.invoice_number || inv.number || "INV-UNKNOWN") as string,
          clientName: (inv.bill_to || inv.clientName || "Valued Client") as string,
          amount: Number(inv.total ?? inv.amount ?? 0),
          currency: (inv.currency || "USD") as Currency,
          status: (isOverdue ? "overdue" : inv.status || "sent") as InvoiceStatus,
          issueDate: (inv.invoice_date || inv.issueDate || today) as string,
          dueDate: (inv.due_date || inv.dueDate || today) as string,
          preflight: (inv.preflight_summary || inv.preflight || { blockers: 0, warnings: 0 }) as {
            blockers: number;
            warnings: number;
          },
          paypalInvoiceId: (inv.paypal_invoice_id || inv.paypalInvoiceId) as string | undefined,
          payerLink: (inv.payer_view_url ||
            inv.payerLink ||
            (inv.paypal_invoice_id
              ? `https://www.sandbox.paypal.com/invoice/p/#${inv.paypal_invoice_id}`
              : undefined)) as string | undefined,
          updatedNote:
            inv.status === "paid" ? "Paid" : inv.status === "draft" ? "Draft saved" : "Sent",
        };
      });

      // Merge backend invoices with locally created session invoices so nothing is lost
      for (const localInv of db.invoices) {
        if (!mapped.some((m) => m.number === localInv.number || m.id === localInv.id)) {
          mapped.unshift(localInv);
        }
      }

      return mapped;
    }
  } catch (err) {
    console.warn("[api] Could not fetch live invoices from backend:", err);
  }

  await delay(150);
  return clone(db.invoices).map(withDerivedStatus);
}

function randomBlock(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Sends the invoice through PayPal (sandbox). Mock: records it as Sent with a fake PayPal ID. */
export async function sendInvoice(invoice: DraftInvoice, issues: Issue[]): Promise<InvoiceRecord> {
  const backendBase = API_BASE_URL;
  try {
    const res = await fetch(`${backendBase}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice, issues }),
    });
    if (res.ok) {
      const data = await res.json();
      const record = (data.data || data) as InvoiceRecord;
      if (record && record.number) {
        db.invoices.unshift(record);
        saveDb(db);
        return record;
      }
    }
  } catch (err) {
    console.warn("[api] Live send invoice failed or offline, recording in sandbox:", err);
  }

  await delay(800);
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
  saveDb(db);
  return clone(record);
}

/** Simulates the PayPal INVOICING.INVOICE.PAID webhook or updates DB. */
export async function markPaid(invoiceId: string): Promise<InvoiceRecord> {
  const backendBase = API_BASE_URL;
  try {
    const res = await fetch(`${backendBase}/api/invoices/${invoiceId}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      const raw = data.invoice || data;
      const today = todayIso();
      const isOverdue = raw.status === "sent" && (raw.due_date || raw.dueDate) < today;
      const updated: InvoiceRecord = {
        id: raw.id,
        number: raw.invoice_number || raw.number || "INV-UNKNOWN",
        clientName: raw.bill_to || raw.clientName || "Valued Client",
        amount: Number(raw.total ?? raw.amount ?? 0),
        currency: (raw.currency || "USD") as Currency,
        status: (isOverdue ? "overdue" : raw.status || "paid") as InvoiceStatus,
        issueDate: raw.invoice_date || raw.issueDate || today,
        dueDate: raw.due_date || raw.dueDate || today,
        preflight: raw.preflight_summary || raw.preflight || { blockers: 0, warnings: 0 },
        paypalInvoiceId: raw.paypal_invoice_id || raw.paypalInvoiceId,
        payerLink: raw.payer_view_url || raw.payerLink,
        updatedNote: "Paid via sandbox",
      };
      const idx = db.invoices.findIndex((i) => i.id === invoiceId);
      if (idx !== -1) db.invoices[idx] = updated;
      saveDb(db);
      return updated;
    }
  } catch (err) {
    console.warn("[api] Could not mark invoice paid on backend:", err);
  }

  await delay(500);
  const inv = db.invoices.find((i) => i.id === invoiceId);
  if (!inv) throw new ApiError("Invoice not found.");
  if (inv.status !== "sent" && inv.status !== "overdue")
    throw new ApiError("Only sent or overdue invoices can be marked paid.");
  inv.status = "paid";
  inv.updatedNote = "Paid via webhook, just now";
  saveDb(db);
  return clone(inv);
}
