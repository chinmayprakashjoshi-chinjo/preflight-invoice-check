import { todayIso } from "@/lib/format";
import type { Currency, DraftInvoice, LineItem } from "@/lib/types";

let lineCounter = 1;

export function newLineItem(partial: Partial<LineItem> = {}): LineItem {
  lineCounter += 1;
  return {
    id: `li-${lineCounter}-${Date.now().toString(36)}`,
    description: "",
    quantity: 1,
    unitPrice: 0,
    ...partial,
  };
}

export function emptyDraft(
  opts: { amount?: number | undefined; currency?: Currency | undefined } = {},
): DraftInvoice {
  return {
    clientId: null,
    clientName: "",
    sendTo: "",
    currency: opts.currency ?? "USD",
    paymentTerms: "Net 30",
    poNumber: "",
    vatId: "",
    invoiceDate: todayIso(),
    // Stable id for the first row keeps server and client markup identical.
    lineItems: [{ id: "li-1", description: "", quantity: 1, unitPrice: opts.amount ?? 0 }],
  };
}

/**
 * The demo case: Acme's AP rules are violated on purpose (no PO, wrong bill-to name, vague line),
 * so pre-flight is never empty on first load.
 */
export function demoDraft(
  opts: { amount?: number | undefined; currency?: Currency | undefined } = {},
): DraftInvoice {
  return {
    clientId: "acme",
    clientName: "Acme Corp",
    sendTo: "ap@acme.example",
    currency: opts.currency ?? "USD",
    paymentTerms: "Net 30",
    poNumber: "",
    vatId: "",
    invoiceDate: todayIso(),
    lineItems: [
      { id: "li-1", description: "Site redesign", quantity: 1, unitPrice: opts.amount ?? 1200 },
    ],
  };
}
