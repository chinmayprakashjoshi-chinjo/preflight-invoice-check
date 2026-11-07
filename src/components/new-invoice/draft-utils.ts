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

export function emptyDraft(opts: { amount?: number; currency?: Currency } = {}): DraftInvoice {
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
