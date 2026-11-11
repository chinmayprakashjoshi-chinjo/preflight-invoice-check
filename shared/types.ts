import { z } from "zod";

/* ---------- Shared enums ---------- */

export const CurrencySchema = z.enum([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
  "INR",
  "CNY",
  "CHF",
  "SGD",
  "NZD",
  "HKD",
  "SEK",
  "NOK",
  "MXN",
  "BRL",
  "ZAR",
]);
export type Currency = z.infer<typeof CurrencySchema>;
export const CURRENCIES: Currency[] = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
  "INR",
  "CNY",
  "CHF",
  "SGD",
  "NZD",
  "HKD",
  "SEK",
  "NOK",
  "MXN",
  "BRL",
  "ZAR",
];

export const PaymentTermsSchema = z.enum(["Net 15", "Net 30", "Net 45"]);
export type PaymentTerms = z.infer<typeof PaymentTermsSchema>;
export const PAYMENT_TERMS: PaymentTerms[] = ["Net 15", "Net 30", "Net 45"];

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/* ---------- Draft invoice (the editable form) ---------- */

export const LineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
});
export type LineItem = z.infer<typeof LineItemSchema>;

export const DraftInvoiceSchema = z.object({
  /** Which client account's AP rules apply. Null = nobody chosen yet. */
  clientId: z.string().nullable(),
  /** Free-text name printed on the invoice. Can differ from the client's legal name. */
  clientName: z.string(),
  /** Email address the invoice will be sent to. */
  sendTo: z.string(),
  currency: CurrencySchema,
  paymentTerms: PaymentTermsSchema,
  poNumber: z.string(),
  vatId: z.string(),
  /** ISO date, yyyy-mm-dd */
  invoiceDate: z.string(),
  lineItems: z.array(LineItemSchema),
});
export type DraftInvoice = z.infer<typeof DraftInvoiceSchema>;

/* ---------- Client AP requirements ---------- */

export const RequirementKeySchema = z.enum([
  "poRequired",
  "legalName",
  "allowedCurrencies",
  "vatRequired",
  "paymentTerms",
  "apEmail",
  "oneInvoicePerFile",
]);
export type RequirementKey = z.infer<typeof RequirementKeySchema>;

export const RequirementMetaSchema = z.object({
  evidence: z.string(),
  confidence: ConfidenceSchema,
  /** True when the requirement was just learned from a pasted rejection email. */
  isNew: z.boolean().optional(),
  /** True once the user has corrected the extracted value by hand. */
  edited: z.boolean().optional(),
});
export type RequirementMeta = z.infer<typeof RequirementMetaSchema>;

export const ClientRequirementsSchema = z.object({
  poRequired: z.boolean(),
  /** An open PO on file, used by the "Add PO" fix. */
  openPoNumber: z.string().optional(),
  /** Exact legal entity name the invoice must carry, if the client specifies one. */
  legalName: z.string().optional(),
  allowedCurrencies: z.array(CurrencySchema).min(1),
  vatRequired: z.boolean(),
  /** VAT ID on file, used by the "Add VAT ID" fix. */
  vatIdOnFile: z.string().optional(),
  paymentTerms: PaymentTermsSchema,
  /** Inbox invoices must be sent to, if the client specifies one. */
  apEmail: z.string().optional(),
  oneInvoicePerFile: z.boolean(),
  /** Evidence quote and confidence for each extracted requirement. */
  meta: z.record(RequirementKeySchema, RequirementMetaSchema),
});
export type ClientRequirements = z.infer<typeof ClientRequirementsSchema>;

export const DocStatusSchema = z.enum(["extracted", "not_extracted", "error"]);
export type DocStatus = z.infer<typeof DocStatusSchema>;

export const ClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  contactEmail: z.string(),
  industry: z.string(),
  sourceDoc: z.object({
    fileName: z.string(),
    kind: z.enum(["PDF vendor guide", "AP policy email", "Onboarding form"]),
    pages: z.number(),
  }),
  docStatus: DocStatusSchema,
  docError: z.string().optional(),
  requirements: ClientRequirementsSchema.nullable(),
});
export type Client = z.infer<typeof ClientSchema>;

/* ---------- Pre-flight ---------- */

export const SeveritySchema = z.enum(["blocker", "warning", "pass"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const FixFieldSchema = z.enum([
  "clientName",
  "poNumber",
  "currency",
  "vatId",
  "paymentTerms",
  "sendTo",
  "lineItemDescription",
]);
export type FixField = z.infer<typeof FixFieldSchema>;

export const IssueSchema = z.object({
  id: z.string(),
  severity: SeveritySchema,
  title: z.string(),
  message: z.string(),
  evidence: z.string().optional(),
  fixLabel: z.string().optional(),
  fixField: FixFieldSchema.optional(),
  fixValue: z.string().optional(),
  /** For line-item fixes: which line item to change. */
  fixTargetId: z.string().optional(),
});
export type Issue = z.infer<typeof IssueSchema>;

/* ---------- Sent / stored invoices ---------- */

export const InvoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue"]);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const InvoiceRecordSchema = z.object({
  id: z.string(),
  number: z.string(),
  clientName: z.string(),
  amount: z.number(),
  currency: CurrencySchema,
  status: InvoiceStatusSchema,
  issueDate: z.string(),
  dueDate: z.string(),
  preflight: z.object({ blockers: z.number(), warnings: z.number() }),
  /** PayPal invoice ID, once sent (mock until the backend is connected). */
  paypalInvoiceId: z.string().optional(),
  payerLink: z.string().optional(),
  /** Last status change, shown in the Updated column. */
  updatedNote: z.string(),
});
export type InvoiceRecord = z.infer<typeof InvoiceRecordSchema>;

/* ---------- Pricer ---------- */

export const PricingInputSchema = z.object({
  targetNet: z.number().min(0),
  currency: CurrencySchema,
  clientCurrency: CurrencySchema,
  crossCurrency: z.boolean(),
});
export type PricingInput = z.infer<typeof PricingInputSchema>;

export const PricingResultSchema = z.object({
  /** Amount to put on the invoice, in the currency the client pays. */
  invoiceAmount: z.number(),
  invoiceCurrency: CurrencySchema,
  /** Gross amount in your own currency before any deductions. */
  grossInOwnCurrency: z.number(),
  paypalFee: z.number(),
  fxSpreadCost: z.number(),
  net: z.number(),
  effectiveCostRate: z.number(),
  explanation: z.string(),
});
export type PricingResult = z.infer<typeof PricingResultSchema>;

/* ---------- API request / response shapes ---------- */

/** Input for POST /api/requirements: an uploaded PDF name, pasted text, or both. */
export const ExtractInputSchema = z.object({
  clientId: z.string(),
  fileName: z.string().optional(),
  text: z.string().optional(),
});
export type ExtractInput = z.infer<typeof ExtractInputSchema>;

/** Response of POST /api/draft: a one-line prompt turned into draft fields. */
export const ParsedDraftSchema = z.object({
  clientName: z.string(),
  amount: z.number(),
  currency: CurrencySchema,
  description: z.string(),
  /** Best-guess client account for the name, if any. */
  clientId: z.string().nullable(),
});
export type ParsedDraft = z.infer<typeof ParsedDraftSchema>;

export const LearnInputSchema = z.object({ clientId: z.string(), text: z.string() });
export type LearnInput = z.infer<typeof LearnInputSchema>;
