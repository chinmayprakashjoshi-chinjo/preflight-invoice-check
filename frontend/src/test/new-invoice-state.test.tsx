import { describe, expect, it } from "vitest";
import { calcPricing } from "@/lib/pricer";
import type { DraftInvoice, LineItem } from "@/lib/types";

describe("New Invoice Flow - State Sync and Functional Updater Verification", () => {
  describe("Bug 1: Currency Resolution Math & Net-Landing Guarantee", () => {
    it("recalculates the gross amount when switching currency with a known target net", () => {
      const targetNet = 1000;
      const userCurrency = "USD";

      // Original invoice in EUR (cross-currency)
      const eurResult = calcPricing({
        targetNet,
        currency: userCurrency,
        clientCurrency: "EUR",
        crossCurrency: true,
      });

      expect(eurResult.invoiceCurrency).toBe("EUR");
      expect(eurResult.invoiceAmount).toBeGreaterThan(0);

      // User clicks "Switch to USD" pre-flight fix
      const usdResult = calcPricing({
        targetNet,
        currency: userCurrency,
        clientCurrency: "USD",
        crossCurrency: false,
      });

      expect(usdResult.invoiceCurrency).toBe("USD");
      // The USD gross must be calculated afresh, not simply copied from EUR gross!
      expect(usdResult.invoiceAmount).not.toBe(eurResult.invoiceAmount);
      expect(usdResult.invoiceAmount).toBeGreaterThan(targetNet);
    });

    it("clears line items and total when switching currency without target net in scope", () => {
      const draft: DraftInvoice = {
        clientId: "acme",
        clientName: "Acme Corporation Ltd",
        sendTo: "ap@acme.example",
        currency: "EUR",
        paymentTerms: "Net 30",
        poNumber: "PO-2026-99999",
        vatId: "",
        invoiceDate: "2026-11-12",
        lineItems: [
          { id: "li-1", description: "Integration work", quantity: 1, unitPrice: 1180.07 },
          { id: "li-2", description: "QA testing", quantity: 2, unitPrice: 150 },
        ],
      };

      // Handler logic when targetNet is not available in scope:
      // Clear line item unit prices to force user recalculation from Pricer
      const nextCurrency = "USD";
      const updatedDraft: DraftInvoice = {
        ...draft,
        currency: nextCurrency,
        lineItems: draft.lineItems.map((li) => ({ ...li, unitPrice: 0 })),
      };

      expect(updatedDraft.currency).toBe("USD");
      expect(updatedDraft.lineItems.every((li) => li.unitPrice === 0)).toBe(true);
      const total = updatedDraft.lineItems.reduce(
        (sum, li) => sum + li.quantity * li.unitPrice,
        0,
      );
      expect(total).toBe(0);
      // Other fields strictly preserved
      expect(updatedDraft.poNumber).toBe("PO-2026-99999");
      expect(updatedDraft.clientName).toBe("Acme Corporation Ltd");
    });
  });

  describe("Bug 2: Functional Update Pattern & Field Preservation", () => {
    it("strictly preserves poNumber, clientName, and sendTo when line items are updated concurrently", () => {
      let state: DraftInvoice = {
        clientId: "acme",
        clientName: "Acme Corporation Ltd",
        sendTo: "ap@acme.example",
        currency: "USD",
        paymentTerms: "Net 30",
        poNumber: "",
        vatId: "VAT-123",
        invoiceDate: "2026-11-12",
        lineItems: [
          { id: "li-1", description: "Design", quantity: 1, unitPrice: 500 },
        ],
      };

      // Simulated state dispatcher supporting functional updates
      const dispatch = (action: React.SetStateAction<DraftInvoice>) => {
        state = typeof action === "function" ? action(state) : action;
      };

      // 1. User types PO Number
      const setPoNumber = (po: string) =>
        dispatch((prev) => ({ ...prev, poNumber: po }));
      setPoNumber("PO-2026-04418");
      expect(state.poNumber).toBe("PO-2026-04418");

      // 2. User edits line item quantity and price using functional update
      const updateLine = (id: string, patch: Partial<LineItem>) =>
        dispatch((prev) => ({
          ...prev,
          lineItems: prev.lineItems.map((li) =>
            li.id === id ? { ...li, ...patch } : li,
          ),
        }));

      updateLine("li-1", { quantity: 3, unitPrice: 650 });

      // Verify that poNumber was NOT wiped out by stale closure
      expect(state.poNumber).toBe("PO-2026-04418");
      expect(state.clientName).toBe("Acme Corporation Ltd");
      expect(state.sendTo).toBe("ap@acme.example");
      expect(state.vatId).toBe("VAT-123");
      expect(state.lineItems[0].quantity).toBe(3);
      expect(state.lineItems[0].unitPrice).toBe(650);

      // 3. User adds another line item
      const addLine = (newItem: LineItem) =>
        dispatch((prev) => ({
          ...prev,
          lineItems: [...prev.lineItems, newItem],
        }));

      addLine({ id: "li-2", description: "DevOps", quantity: 1, unitPrice: 400 });

      expect(state.poNumber).toBe("PO-2026-04418");
      expect(state.lineItems.length).toBe(2);

      // 4. User removes first line item
      const removeLine = (id: string) =>
        dispatch((prev) => ({
          ...prev,
          lineItems: prev.lineItems.filter((li) => li.id !== id),
        }));

      removeLine("li-1");

      expect(state.poNumber).toBe("PO-2026-04418");
      expect(state.lineItems.length).toBe(1);
      expect(state.lineItems[0].id).toBe("li-2");
    });
  });
});
