import { describe, expect, it } from "vitest";
import { EXTRACTED_REQUIREMENTS } from "@/mocks/clients";
import { applyFix, preflight, summarize } from "./preflight";
import type { ClientRequirements, DraftInvoice } from "./types";

const acme = EXTRACTED_REQUIREMENTS.acme;
const northwind = EXTRACTED_REQUIREMENTS.northwind;

const acmeDraft: DraftInvoice = {
  clientId: "acme",
  clientName: "Acme Corp",
  sendTo: "ap@acme.example",
  currency: "USD",
  paymentTerms: "Net 30",
  poNumber: "",
  vatId: "",
  invoiceDate: "2026-11-08",
  lineItems: [{ id: "li-1", description: "site redesign", quantity: 1, unitPrice: 1200 }],
};

const find = (draft: DraftInvoice, req: ClientRequirements, id: string) =>
  preflight(draft, req).find((i) => i.id === id);

describe("preflight rules", () => {
  it("default Acme draft: 2 blockers, 1 warning, 3 passed", () => {
    expect(summarize(preflight(acmeDraft, acme))).toEqual({ blockers: 2, warnings: 1, passed: 3 });
  });

  it("missing PO is a blocker when the client requires one", () => {
    expect(find(acmeDraft, acme, "po-required")?.severity).toBe("blocker");
  });

  it("client name must match the legal entity exactly", () => {
    expect(find(acmeDraft, acme, "legal-name")?.severity).toBe("blocker");
    expect(
      find({ ...acmeDraft, clientName: "Acme Corporation Ltd" }, acme, "legal-name")?.severity,
    ).toBe("pass");
  });

  it("currency outside the allowed list is a blocker", () => {
    expect(find({ ...acmeDraft, currency: "EUR" }, acme, "currency")?.severity).toBe("blocker");
  });

  it("missing VAT ID is a blocker when required", () => {
    const nw: DraftInvoice = {
      ...acmeDraft,
      clientId: "northwind",
      currency: "EUR",
      paymentTerms: "Net 15",
    };
    expect(find(nw, northwind, "vat-id")?.severity).toBe("blocker");
  });

  it("different payment terms are only a warning", () => {
    expect(find({ ...acmeDraft, paymentTerms: "Net 45" }, acme, "payment-terms")?.severity).toBe(
      "warning",
    );
  });

  it("descriptions under 3 words or generic are warnings", () => {
    expect(find(acmeDraft, acme, "description")?.severity).toBe("warning");
    const generic = {
      ...acmeDraft,
      lineItems: [{ id: "li-1", description: "design", quantity: 1, unitPrice: 1200 }],
    };
    expect(find(generic, acme, "description")?.severity).toBe("warning");
  });

  it("invoice must go to the AP email", () => {
    expect(find({ ...acmeDraft, sendTo: "sam@acme.example" }, acme, "ap-email")?.severity).toBe(
      "blocker",
    );
    expect(find(acmeDraft, acme, "ap-email")?.severity).toBe("pass");
  });

  it("applying every fix clears all blockers and warnings", () => {
    let draft = acmeDraft;
    for (let i = 0; i < 10; i++) {
      const open = preflight(draft, acme).find((x) => x.severity !== "pass" && x.fixValue);
      if (!open) break;
      draft = applyFix(draft, open);
    }
    const s = summarize(preflight(draft, acme));
    expect(s.blockers).toBe(0);
    expect(s.warnings).toBe(0);
  });
});
