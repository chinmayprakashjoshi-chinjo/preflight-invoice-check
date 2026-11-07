import type { ClientRequirements, DraftInvoice, Issue } from "./types";

/**
 * Pure pre-flight rules. Given a draft invoice and the client's AP requirements,
 * returns every check as an Issue: blockers, warnings and passes.
 *
 * Rules
 * - PO required and empty                      -> blocker
 * - Client name differs from required legal name -> blocker
 * - Currency not in the allowed list            -> blocker
 * - VAT ID required and empty                   -> blocker
 * - Invoice not addressed to the AP email       -> blocker
 * - Payment terms differ from client's terms    -> warning
 * - Line description under 3 words or generic   -> warning
 */

const GENERIC_DESCRIPTIONS = new Set([
  "services",
  "service",
  "work",
  "design",
  "consulting",
  "development",
  "misc",
  "fee",
  "fees",
  "project",
]);

export function isWeakDescription(description: string): boolean {
  const cleaned = description.trim().toLowerCase().replace(/[.,;:!]+$/g, "");
  if (!cleaned) return true;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 3) return true;
  return GENERIC_DESCRIPTIONS.has(cleaned);
}

/** Suggests a more specific line description the client's AP team can match to a PO. */
export function improveDescription(description: string, invoiceDate: string): string {
  const base = description.trim() || "Professional services";
  const capitalised = base.charAt(0).toUpperCase() + base.slice(1);
  const month = monthYear(invoiceDate);
  return `${capitalised}: scope, deliverables and handover${month ? ` (${month})` : ""}`;
}

function monthYear(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function preflight(invoice: DraftInvoice, req: ClientRequirements): Issue[] {
  const issues: Issue[] = [];
  const quote = (key: keyof ClientRequirements["meta"]) => req.meta[key]?.evidence;

  // 1. PO number
  if (req.poRequired) {
    if (!invoice.poNumber.trim()) {
      issues.push({
        id: "po-required",
        severity: "blocker",
        title: "PO number missing",
        message: "This client rejects invoices without a purchase order reference.",
        evidence: quote("poRequired"),
        fixLabel: "Add PO",
        fixField: "poNumber",
        fixValue: req.openPoNumber ?? "",
      });
    } else {
      issues.push({
        id: "po-required",
        severity: "pass",
        title: "PO reference included",
        message: `PO ${invoice.poNumber.trim()} is on the invoice.`,
        evidence: quote("poRequired"),
      });
    }
  }

  // 2. Legal entity name
  if (req.legalName) {
    if (invoice.clientName.trim() !== req.legalName) {
      issues.push({
        id: "legal-name",
        severity: "blocker",
        title: "Client name does not match legal entity",
        message: invoice.clientName.trim()
          ? `"${invoice.clientName.trim()}" must read exactly "${req.legalName}".`
          : `The invoice must be addressed to "${req.legalName}".`,
        evidence: quote("legalName"),
        fixLabel: "Use legal name",
        fixField: "clientName",
        fixValue: req.legalName,
      });
    } else {
      issues.push({
        id: "legal-name",
        severity: "pass",
        title: "Legal entity name matches",
        message: `Addressed to ${req.legalName}.`,
        evidence: quote("legalName"),
      });
    }
  }

  // 3. Currency
  if (!req.allowedCurrencies.includes(invoice.currency)) {
    const target = req.allowedCurrencies[0];
    issues.push({
      id: "currency",
      severity: "blocker",
      title: `${invoice.currency} is not accepted`,
      message: `This client only pays in ${req.allowedCurrencies.join(" or ")}.`,
      evidence: quote("allowedCurrencies"),
      fixLabel: `Switch to ${target}`,
      fixField: "currency",
      fixValue: target,
    });
  } else {
    issues.push({
      id: "currency",
      severity: "pass",
      title: `Currency ${invoice.currency} accepted`,
      message: `Allowed: ${req.allowedCurrencies.join(", ")}.`,
      evidence: quote("allowedCurrencies"),
    });
  }

  // 4. VAT ID
  if (req.vatRequired) {
    if (!invoice.vatId.trim()) {
      issues.push({
        id: "vat-id",
        severity: "blocker",
        title: "VAT ID missing",
        message: "Invoices without a VAT ID cannot be booked by this client.",
        evidence: quote("vatRequired"),
        fixLabel: "Add VAT ID",
        fixField: "vatId",
        fixValue: req.vatIdOnFile ?? "",
      });
    } else {
      issues.push({
        id: "vat-id",
        severity: "pass",
        title: "VAT ID included",
        message: `VAT ID ${invoice.vatId.trim()} is on the invoice.`,
        evidence: quote("vatRequired"),
      });
    }
  }

  // 5. AP email
  if (req.apEmail) {
    if (norm(invoice.sendTo) !== norm(req.apEmail)) {
      issues.push({
        id: "ap-email",
        severity: "blocker",
        title: "Not addressed to the AP inbox",
        message: invoice.sendTo.trim()
          ? `${invoice.sendTo.trim()} is not monitored by accounts payable. Send to ${req.apEmail}.`
          : `Add the AP inbox ${req.apEmail} as the recipient.`,
        evidence: quote("apEmail"),
        fixLabel: "Use AP email",
        fixField: "sendTo",
        fixValue: req.apEmail,
      });
    } else {
      issues.push({
        id: "ap-email",
        severity: "pass",
        title: "Going to the AP inbox",
        message: `Will be sent to ${req.apEmail}.`,
        evidence: quote("apEmail"),
      });
    }
  }

  // 6. Payment terms
  if (invoice.paymentTerms !== req.paymentTerms) {
    issues.push({
      id: "payment-terms",
      severity: "warning",
      title: "Payment terms differ from contract",
      message: `You chose ${invoice.paymentTerms}; this client pays on ${req.paymentTerms}. AP will likely pay on their terms.`,
      evidence: quote("paymentTerms"),
      fixLabel: `Use ${req.paymentTerms}`,
      fixField: "paymentTerms",
      fixValue: req.paymentTerms,
    });
  } else {
    issues.push({
      id: "payment-terms",
      severity: "pass",
      title: `Payment terms ${req.paymentTerms}`,
      message: "Matches the client's standard terms.",
      evidence: quote("paymentTerms"),
    });
  }

  // 7. Line item descriptions
  const weak = invoice.lineItems.find((li) => isWeakDescription(li.description));
  if (weak) {
    const label = weak.description.trim() || "(empty)";
    issues.push({
      id: "description",
      severity: "warning",
      title: "Line description is too vague",
      message: `"${label}" may be queried. AP teams match line items to the PO scope.`,
      evidence: req.poRequired ? quote("poRequired") : undefined,
      fixLabel: "Improve",
      fixField: "lineItemDescription",
      fixValue: improveDescription(weak.description, invoice.invoiceDate),
      fixTargetId: weak.id,
    });
  } else if (invoice.lineItems.length > 0) {
    issues.push({
      id: "description",
      severity: "pass",
      title: "Line descriptions are specific",
      message: "Each line explains what was delivered.",
    });
  }

  return issues;
}

/** Applies an issue's suggested fix to the draft. Returns a new draft. */
export function applyFix(invoice: DraftInvoice, issue: Issue): DraftInvoice {
  if (!issue.fixField || issue.fixValue === undefined) return invoice;
  const v = issue.fixValue;
  switch (issue.fixField) {
    case "clientName":
      return { ...invoice, clientName: v };
    case "poNumber":
      return { ...invoice, poNumber: v };
    case "vatId":
      return { ...invoice, vatId: v };
    case "sendTo":
      return { ...invoice, sendTo: v };
    case "currency":
      return v === "USD" || v === "EUR" ? { ...invoice, currency: v } : invoice;
    case "paymentTerms":
      return v === "Net 15" || v === "Net 30" || v === "Net 45"
        ? { ...invoice, paymentTerms: v }
        : invoice;
    case "lineItemDescription":
      return {
        ...invoice,
        lineItems: invoice.lineItems.map((li) =>
          li.id === issue.fixTargetId ? { ...li, description: v } : li,
        ),
      };
  }
}

export function summarize(issues: Issue[]) {
  return {
    blockers: issues.filter((i) => i.severity === "blocker").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    passed: issues.filter((i) => i.severity === "pass").length,
  };
}
