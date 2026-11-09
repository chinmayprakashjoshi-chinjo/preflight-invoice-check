import type { ClientRequirements, Confidence, RequirementKey } from "./types";

export interface RequirementRow {
  key: RequirementKey;
  label: string;
  value: string;
  evidence: string;
  confidence: Confidence;
  edited: boolean;
  isNew: boolean;
}

export const REQUIREMENT_LABELS: Record<RequirementKey, string> = {
  poRequired: "PO number on invoice",
  legalName: "Exact legal entity name",
  allowedCurrencies: "Accepted currencies",
  vatRequired: "VAT ID on invoice",
  paymentTerms: "Payment terms",
  apEmail: "AP inbox",
  oneInvoicePerFile: "One invoice per file",
};

const ORDER: RequirementKey[] = [
  "poRequired",
  "legalName",
  "allowedCurrencies",
  "vatRequired",
  "paymentTerms",
  "apEmail",
  "oneInvoicePerFile",
];

export function requirementValue(req: ClientRequirements, key: RequirementKey): string {
  switch (key) {
    case "poRequired":
      return req.poRequired ? "Required" : "Not required";
    case "legalName":
      return req.legalName ?? "Not specified";
    case "allowedCurrencies":
      return req.allowedCurrencies.join(", ");
    case "vatRequired":
      return req.vatRequired ? "Required" : "Not required";
    case "paymentTerms":
      return req.paymentTerms;
    case "apEmail":
      return req.apEmail ?? "Not specified";
    case "oneInvoicePerFile":
      return req.oneInvoicePerFile ? "Required" : "Not required";
  }
}

export function requirementRows(req: ClientRequirements): RequirementRow[] {
  return ORDER.filter((k) => req.meta[k]).map((key) => {
    const meta = req.meta[key]!;
    return {
      key,
      label: REQUIREMENT_LABELS[key],
      value: requirementValue(req, key),
      evidence: meta.evidence,
      confidence: meta.confidence,
      edited: Boolean(meta.edited),
      isNew: Boolean(meta.isNew),
    };
  });
}

/** Marks a requirement as corrected by the user. */
export function markEdited(req: ClientRequirements, key: RequirementKey): ClientRequirements {
  const meta = req.meta[key];
  return {
    ...req,
    meta: {
      ...req.meta,
      [key]: { evidence: meta?.evidence ?? "Entered by you.", confidence: "high", edited: true },
    },
  };
}
