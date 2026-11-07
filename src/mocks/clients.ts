import type { Client, ClientRequirements } from "@/lib/types";

/**
 * Requirements PreFlight "extracts" from each client's AP document.
 * Kept separate so the Clients screen can simulate extraction.
 */
export const EXTRACTED_REQUIREMENTS: Record<string, ClientRequirements> = {
  acme: {
    poRequired: true,
    openPoNumber: "PO-2026-04418",
    legalName: "Acme Corporation Ltd",
    allowedCurrencies: ["USD"],
    vatRequired: false,
    paymentTerms: "Net 30",
    apEmail: "ap@acme.example",
    oneInvoicePerFile: false,
    meta: {
      poRequired: {
        evidence:
          "All invoices must reference a valid PO number. Invoices without a PO will be returned unpaid.",
        confidence: "high",
      },
      legalName: {
        evidence:
          'Invoices must be addressed to our legal entity, "Acme Corporation Ltd", exactly as registered.',
        confidence: "high",
      },
      allowedCurrencies: {
        evidence: "We process supplier payments in US Dollars (USD) only.",
        confidence: "high",
      },
      vatRequired: {
        evidence: "A VAT or tax ID is not required for US-based suppliers.",
        confidence: "medium",
      },
      paymentTerms: {
        evidence: "Standard payment terms are Net 30 from the date of a compliant invoice.",
        confidence: "high",
      },
      apEmail: {
        evidence: "Submit invoices as PDF to ap@acme.example. Invoices sent elsewhere are not processed.",
        confidence: "high",
      },
      oneInvoicePerFile: {
        evidence: "Multiple invoices may be attached to a single email.",
        confidence: "medium",
      },
    },
  },
  northwind: {
    poRequired: false,
    allowedCurrencies: ["EUR"],
    vatRequired: true,
    vatIdOnFile: "NL859123456B01",
    paymentTerms: "Net 15",
    oneInvoicePerFile: false,
    meta: {
      poRequired: {
        evidence: "We do not issue purchase orders for freelance engagements.",
        confidence: "high",
      },
      allowedCurrencies: {
        evidence: "Please invoice in euro (EUR). We cannot pay invoices in other currencies.",
        confidence: "high",
      },
      vatRequired: {
        evidence: "Your VAT identification number must appear on every invoice.",
        confidence: "high",
      },
      paymentTerms: {
        evidence: "We pay supplier invoices within 15 days of receipt.",
        confidence: "medium",
      },
      oneInvoicePerFile: {
        evidence: "No requirement found in the document.",
        confidence: "low",
      },
    },
  },
  globex: {
    poRequired: false,
    legalName: "Globex Inc",
    allowedCurrencies: ["USD", "EUR"],
    vatRequired: false,
    paymentTerms: "Net 45",
    apEmail: "payables@globex.example",
    oneInvoicePerFile: true,
    meta: {
      poRequired: {
        evidence: "A PO is only required for engagements above $25,000.",
        confidence: "medium",
      },
      legalName: {
        evidence: 'Bill to: "Globex Inc", 1 Cypress Creek Parkway.',
        confidence: "medium",
      },
      allowedCurrencies: {
        evidence: "Invoices may be issued in USD or EUR.",
        confidence: "high",
      },
      vatRequired: {
        evidence: "Tax identifiers are optional for non-EU suppliers.",
        confidence: "low",
      },
      paymentTerms: {
        evidence: "Payment terms for all vendors are Net 45.",
        confidence: "high",
      },
      apEmail: {
        evidence:
          "Invoices must go to payables@globex.example, not to your project contact.",
        confidence: "high",
      },
      oneInvoicePerFile: {
        evidence: "Submit one invoice per PDF file. Combined files will be rejected.",
        confidence: "high",
      },
    },
  },
};

export const MOCK_CLIENTS: Client[] = [
  {
    id: "acme",
    name: "Acme Corporation Ltd",
    contactEmail: "ap@acme.example",
    industry: "Manufacturing",
    sourceDoc: { fileName: "acme-supplier-invoicing-policy.pdf", kind: "AP policy email", pages: 3 },
    docStatus: "extracted",
    requirements: EXTRACTED_REQUIREMENTS.acme,
  },
  {
    id: "northwind",
    name: "Northwind Studio",
    contactEmail: "finance@northwind.example",
    industry: "Design agency",
    sourceDoc: { fileName: "northwind-freelancer-onboarding.pdf", kind: "Onboarding form", pages: 2 },
    docStatus: "extracted",
    requirements: EXTRACTED_REQUIREMENTS.northwind,
  },
  {
    id: "globex",
    name: "Globex Inc",
    contactEmail: "projects@globex.example",
    industry: "Energy",
    sourceDoc: { fileName: "globex-vendor-guide-2026.pdf", kind: "PDF vendor guide", pages: 14 },
    docStatus: "error",
    docError:
      "Could not read the AP document. The PDF looks like a scanned image with no text layer.",
    requirements: null,
  },
];
