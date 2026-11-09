/**
 * Data access layer. Every screen talks to the backend through these functions only.
 *
 * Today they return mock data after a short delay. To connect the real backend, set
 * VITE_API_BASE_URL and replace each function body with a fetch to `${API_BASE_URL}/...`.
 * Components and their types stay the same.
 */
import { getExtractedRequirements, MOCK_CLIENTS } from "@/mocks/clients";
import { MOCK_INVOICES } from "@/mocks/invoices";
import { dueDateFor, invoiceTotal } from "./format";
import { preflight, summarize } from "./preflight";
import { calcPricing as calcPricingPure } from "./pricer";
import type {
  Client,
  ClientRequirements,
  DraftInvoice,
  InvoiceRecord,
  Issue,
  PricingInput,
  PricingResult,
} from "./types";

export const API_BASE_URL: string = import.meta.env["VITE_API_BASE_URL"] ?? "";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T>(v: T): T => structuredClone(v);

/* In-memory mock database for this browser session. */
const db = {
  clients: clone(MOCK_CLIENTS),
  invoices: clone(MOCK_INVOICES),
  nextInvoiceNumber: 109,
};

export class ApiError extends Error {}

/* ---------- Clients ---------- */

export async function getClients(): Promise<Client[]> {
  await delay(350);
  return clone(db.clients);
}

/**
 * Reads the client's AP document and returns structured requirements.
 * Mock: always succeeds after 1.5s and stores the result on the client.
 */
export async function extractRequirements(
  clientId: string,
  fileName?: string,
): Promise<Client> {
  await delay(1500);
  const client = db.clients.find((c) => c.id === clientId);
  const extracted = getExtractedRequirements(clientId);
  if (!client || !extracted) throw new ApiError("Could not read the AP document.");
  client.requirements = clone(extracted);
  client.docStatus = "extracted";
  client.docError = undefined;
  if (fileName) client.sourceDoc = { ...client.sourceDoc, fileName };
  return clone(client);
}

export async function updateRequirements(
  clientId: string,
  requirements: ClientRequirements,
): Promise<Client> {
  await delay(250);
  const client = db.clients.find((c) => c.id === clientId);
  if (!client) throw new ApiError("Client not found.");
  client.requirements = clone(requirements);
  return clone(client);
}

/* ---------- Pre-flight ---------- */

/** Runs the pre-flight rules. Mock runs the local pure function with no delay. */
export async function runPreflight(
  invoice: DraftInvoice,
  requirements: ClientRequirements,
): Promise<Issue[]> {
  return preflight(invoice, requirements);
}

/* ---------- Pricer ---------- */

export async function calcPricing(input: PricingInput): Promise<PricingResult> {
  return calcPricingPure(input);
}

/* ---------- Invoices ---------- */

export async function getInvoices(): Promise<InvoiceRecord[]> {
  await delay(400);
  return clone(db.invoices);
}

/** Sends the invoice through PayPal (sandbox). Mock: records it as Sent. */
export async function sendInvoice(
  invoice: DraftInvoice,
  issues: Issue[],
): Promise<InvoiceRecord> {
  await delay(1200);
  const { blockers, warnings } = summarize(issues);
  if (blockers > 0) throw new ApiError("Resolve all blockers before sending.");
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
  };
  db.invoices.unshift(record);
  return clone(record);
}

export async function markPaid(invoiceId: string): Promise<InvoiceRecord> {
  await delay(500);
  const inv = db.invoices.find((i) => i.id === invoiceId);
  if (!inv) throw new ApiError("Invoice not found.");
  if (inv.status !== "sent" && inv.status !== "overdue") {
    throw new ApiError("Only sent or overdue invoices can be marked paid.");
  }
  inv.status = "paid";
  return clone(inv);
}

export async function sendReminder(invoiceId: string): Promise<void> {
  await delay(500);
  if (!db.invoices.some((i) => i.id === invoiceId)) throw new ApiError("Invoice not found.");
}
