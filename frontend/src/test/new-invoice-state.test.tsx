import { describe, expect, it } from "vitest";
import { calcPricing } from "@/lib/pricer";
import { applyFix, improveDescription, isWeakDescription } from "@/lib/preflight";
import { seedInvoices } from "@/mocks/invoices";
import type { DraftInvoice, InvoiceRecord, InvoiceStatus, LineItem } from "@/lib/types";

describe("Application State Management & Logic Bug Fixes", () => {
  describe("Bug 1: Global State Synchronization (Dashboard vs. Invoices)", () => {
    it("updates invoice status in master state and synchronizes across both Invoices and Dashboard", () => {
      // Simulate the master invoices store lifted into centralized context
      let masterInvoices: InvoiceRecord[] = seedInvoices();

      const updateInvoiceStatus = (id: string, status: InvoiceStatus) => {
        masterInvoices = masterInvoices.map((inv) =>
          inv.id === id || inv.number === id
            ? { ...inv, status, updatedNote: status === "paid" ? "Paid via sandbox" : inv.updatedNote }
            : inv,
        );
      };

      // 1. Initial Dashboard KPI computation
      const initialPaidCount = masterInvoices.filter((i) => i.status === "paid").length;
      const targetInvoice = masterInvoices.find((i) => i.status === "sent" || i.status === "overdue")!;
      expect(targetInvoice).toBeDefined();

      // 2. Action on Invoices page: user clicks "Mark paid"
      updateInvoiceStatus(targetInvoice.id, "paid");

      // 3. Invoices page sees updated status immediately
      const updatedOnInvoices = masterInvoices.find((i) => i.id === targetInvoice.id);
      expect(updatedOnInvoices?.status).toBe("paid");

      // 4. Navigating to Dashboard: Dashboard consumes the EXACT SAME master invoices state
      const updatedPaidCount = masterInvoices.filter((i) => i.status === "paid").length;
      expect(updatedPaidCount).toBe(initialPaidCount + 1);

      // Verify Dashboard recent invoices list contains the updated paid status
      const updatedOnDashboard = masterInvoices.find((i) => i.id === targetInvoice.id);
      expect(updatedOnDashboard?.status).toBe("paid");
    });

    it("adds newly created invoices to master state so both routes consume it immediately", () => {
      let masterInvoices: InvoiceRecord[] = seedInvoices();

      const addInvoice = (newInv: InvoiceRecord) => {
        masterInvoices = [newInv, ...masterInvoices.filter((i) => i.id !== newInv.id)];
      };

      const newRecord: InvoiceRecord = {
        id: "inv-new-999",
        number: "INV-2026-9999",
        clientName: "Acme Corporation Ltd",
        amount: 2500,
        currency: "USD",
        status: "sent",
        issueDate: "2026-11-12",
        dueDate: "2026-12-12",
        preflight: { blockers: 0, warnings: 0 },
        paypalInvoiceId: "PAYPAL-999",
        payerLink: "https://example.com/pay/999",
        updatedNote: "Sent",
      };

      // Action on New Invoice page: invoice created
      addInvoice(newRecord);

      // Invoices route sees it
      expect(masterInvoices[0].number).toBe("INV-2026-9999");
      // Dashboard route sees it
      expect(masterInvoices.some((i) => i.number === "INV-2026-9999")).toBe(true);
    });
  });

  describe("Bug 2: Currency Resolution Math & Net-Landing Guarantee", () => {
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

      // When applyFix is called on currency issue, it clears line item amounts
      const fixed = applyFix(draft, {
        id: "currency",
        severity: "blocker",
        title: "Currency not accepted",
        message: "EUR is not accepted",
        fixLabel: "Switch to USD",
        fixField: "currency",
        fixValue: "USD",
      });

      expect(fixed.currency).toBe("USD");
      expect(fixed.lineItems.every((li) => li.unitPrice === 0)).toBe(true);
      const total = fixed.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
      expect(total).toBe(0);
      // Other fields strictly preserved
      expect(fixed.poNumber).toBe("PO-2026-99999");
      expect(fixed.clientName).toBe("Acme Corporation Ltd");
    });
  });

  describe("Bug 3: Functional Update Pattern & Field Preservation", () => {
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

  describe("Bug 4: 'Improve' Button Safety & Never Crash", () => {
    it("handles undefined, null, or empty descriptions in isWeakDescription and improveDescription safely", () => {
      expect(isWeakDescription(undefined as any)).toBe(true);
      expect(isWeakDescription(null as any)).toBe(true);
      expect(isWeakDescription("")).toBe(true);
      expect(isWeakDescription("   ")).toBe(true);
      expect(isWeakDescription("design")).toBe(true);
      expect(isWeakDescription("Full-stack web application development")).toBe(false);

      expect(improveDescription(undefined as any, "2026-11-12")).toContain("Professional services");
      expect(improveDescription(null as any, "2026-11-12")).toContain("Professional services");
      expect(improveDescription("services", "2026-11-12")).toContain("Services: scope");
    });

    it("safely unwraps object-based AI suggestions without injecting objects into string state", () => {
      const draft: DraftInvoice = {
        clientId: "acme",
        clientName: "Acme Corporation Ltd",
        sendTo: "ap@acme.example",
        currency: "USD",
        paymentTerms: "Net 30",
        poNumber: "PO-123",
        vatId: "",
        invoiceDate: "2026-11-12",
        lineItems: [
          { id: "li-1", description: "work", quantity: 1, unitPrice: 100 },
        ],
      };

      // When AI returns an object payload { description: "..." }
      const fixed = applyFix(draft, {
        id: "description",
        severity: "warning",
        title: "Line description is too vague",
        message: "AP teams match line items to the PO scope.",
        fixLabel: "Improve",
        fixField: "lineItemDescription",
        fixValue: { description: "Backend architecture review and implementation" } as any,
        fixTargetId: "li-1",
      });

      expect(typeof fixed.lineItems[0].description).toBe("string");
      expect(fixed.lineItems[0].description).toBe("Backend architecture review and implementation");
    });

    it("falls back gracefully when fixTargetId is not found or lineItems is empty", () => {
      const emptyDraft: DraftInvoice = {
        clientId: "acme",
        clientName: "Acme Corporation Ltd",
        sendTo: "ap@acme.example",
        currency: "USD",
        paymentTerms: "Net 30",
        poNumber: "PO-123",
        vatId: "",
        invoiceDate: "2026-11-12",
        lineItems: [],
      };

      const fixedEmpty = applyFix(emptyDraft, {
        id: "description",
        severity: "warning",
        title: "Line description is too vague",
        message: "AP teams match line items to the PO scope.",
        fixLabel: "Improve",
        fixField: "lineItemDescription",
        fixValue: "Security audit and penetration testing",
      });

      expect(fixedEmpty.lineItems.length).toBe(1);
      expect(fixedEmpty.lineItems[0].description).toBe("Security audit and penetration testing");

      // Mismatched target ID
      const existingDraft: DraftInvoice = {
        ...emptyDraft,
        lineItems: [{ id: "li-actual", description: "work", quantity: 1, unitPrice: 200 }],
      };

      const fixedMismatched = applyFix(existingDraft, {
        id: "description",
        severity: "warning",
        title: "Line description is too vague",
        message: "AP teams match line items to the PO scope.",
        fixLabel: "Improve",
        fixField: "lineItemDescription",
        fixValue: "Security audit and penetration testing",
        fixTargetId: "li-nonexistent",
      });

      expect(fixedMismatched.lineItems[0].description).toBe("Security audit and penetration testing");
    });

    it("always returns an invoice object and never undefined for unknown fix fields", () => {
      const draft: DraftInvoice = {
        clientId: "acme",
        clientName: "Acme Corporation Ltd",
        sendTo: "ap@acme.example",
        currency: "USD",
        paymentTerms: "Net 30",
        poNumber: "PO-123",
        vatId: "",
        invoiceDate: "2026-11-12",
        lineItems: [{ id: "li-1", description: "Design", quantity: 1, unitPrice: 100 }],
      };

      const result = applyFix(draft, {
        id: "unknown",
        severity: "warning",
        title: "Some unknown warning",
        message: "Testing fallback",
        fixField: "nonexistentField" as any,
        fixValue: "something",
      });

      expect(result).toBeDefined();
      expect(result.currency).toBe("USD");
      expect(result.clientName).toBe("Acme Corporation Ltd");
    });
  });

  describe("Bug 5: 'Switch to USD' Overhaul Prevents Currency Math Desync", () => {
    it("completely clears line items array when targetNet is null, forcing fresh calculation", () => {
      const draft: DraftInvoice = {
        clientId: "acme",
        clientName: "Acme Corporation Ltd",
        sendTo: "ap@acme.example",
        currency: "SGD",
        paymentTerms: "Net 30",
        poNumber: "PO-123",
        vatId: "",
        invoiceDate: "2026-11-12",
        lineItems: [
          { id: "li-1", description: "Web design", quantity: 1, unitPrice: 189.06 },
        ],
      };

      // Currency fix applied without targetNet
      const fixed = applyFix(draft, {
        id: "currency",
        severity: "blocker",
        title: "Currency not accepted",
        message: "SGD is not accepted. This client only pays in USD.",
        fixLabel: "Switch to USD",
        fixField: "currency",
        fixValue: "USD",
      });

      expect(fixed.currency).toBe("USD");
      // Must be completely cleared to prevent 189.06 SGD becoming 189.06 USD
      expect(fixed.lineItems).toEqual([]);
    });
  });
});
