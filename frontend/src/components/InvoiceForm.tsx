import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clientsQuery } from "@/lib/queries";
import {
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  AlertOctagon,
  CheckCircle2,
  Loader2,
  Send,
  Building2,
  Mail,
  Receipt,
  FileCheck2,
  Wand2,
} from "lucide-react";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface BlockerIssue {
  id: string;
  severity: string;
  title: string;
  message: string;
  evidence?: string;
  fixLabel?: string;
  fixField?: string;
  fixValue?: string;
}

interface AIReview {
  approved?: boolean;
  score?: number;
  summary?: string;
  recommendations?: string[];
  status?: string;
}

interface SuccessData {
  id?: string;
  invoice_number: string;
  paypal_invoice_id: string;
  payer_view_url: string;
  status: string;
  bill_to: string;
  send_to: string;
  currency: string;
  total: number;
  ai_review?: AIReview;
}

const CLIENT_PRESETS = [
  {
    name: "Acme Corporation Ltd",
    email: "ap@acme.example",
    currency: "USD",
    poHint: "PO-2026-04418",
    note: "Strict AP: PO number required, legal entity match required.",
  },
  {
    name: "Northwind Studio",
    email: "finance@northwind.example",
    currency: "EUR",
    poHint: "",
    note: "EUR only, VAT ID required, Net 15.",
  },
  {
    name: "Globex Inc",
    email: "payables@globex.example",
    currency: "USD",
    poHint: "",
    note: "Single invoice per PDF, Net 45.",
  },
];

export function InvoiceForm() {
  const clientsQ = useQuery(clientsQuery);
  const clients = clientsQ.data ?? [];

  const [clientName, setClientName] = useState("Acme Corporation Ltd");
  const [sendTo, setSendTo] = useState("ap@acme.example");
  const [currency, setCurrency] = useState("USD");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [poNumber, setPoNumber] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: "item-1",
      description: "Frontend application integration & QA testing",
      quantity: 1,
      unitPrice: 120,
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [blockers, setBlockers] = useState<BlockerIssue[] | null>(null);
  const [blockerMessage, setBlockerMessage] = useState<string>("");
  const [aiReviewData, setAiReviewData] = useState<AIReview | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // Determine if PO is required for currently active client
  const activeClient = clients.find(
    (c) =>
      c.name.toLowerCase() === clientName.toLowerCase() ||
      c.id.toLowerCase() === clientName.toLowerCase() ||
      c.name.toLowerCase().includes(clientName.toLowerCase()) ||
      clientName.toLowerCase().includes(c.name.toLowerCase()),
  );
  const poRequired =
    activeClient && activeClient.requirements
      ? activeClient.requirements.poRequired
      : false;

  // Calculate invoice total
  const totalAmount = lineItems.reduce(
    (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );

  const handleClientPresetChange = (name: string) => {
    setClientName(name);
    const matched = clients.find((c) => c.name === name || c.id === name);
    if (matched) {
      if (matched.requirements?.apEmail || matched.contactEmail) {
        setSendTo(matched.requirements?.apEmail || matched.contactEmail);
      }
      if (matched.requirements?.allowedCurrencies?.[0]) {
        setCurrency(matched.requirements.allowedCurrencies[0]);
      }
      if (matched.requirements?.paymentTerms) {
        setPaymentTerms(matched.requirements.paymentTerms);
      }
      return;
    }
    const preset = CLIENT_PRESETS.find((p) => p.name === name);
    if (preset) {
      setSendTo(preset.email);
      setCurrency(preset.currency);
    }
  };

  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: `item-${Date.now()}`,
        description: "",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const handleItemChange = (id: string, field: keyof LineItem, val: string | number) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: val };
        }
        return item;
      }),
    );
  };

  const handleQuickFix = (blocker: BlockerIssue) => {
    if (blocker.fixField === "poNumber") {
      setPoNumber(blocker.fixValue || "PO-2026-04418");
    } else if (blocker.fixField === "clientName") {
      setClientName(blocker.fixValue || "Acme Corporation Ltd");
    } else if (blocker.fixField === "currency") {
      setCurrency(blocker.fixValue || "USD");
    }
    // Remove the fixed blocker from the list
    if (blockers) {
      const remaining = blockers.filter((b) => b.id !== blocker.id);
      setBlockers(remaining.length > 0 ? remaining : null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setBlockers(null);
    setGeneralError(null);
    setSuccessData(null);
    setAiReviewData(null);

    const payload = {
      clientName,
      sendTo,
      currency,
      paymentTerms,
      poNumber: poNumber.trim(),
      items: lineItems.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
      })),
    };

    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

    try {
      const res = await fetch(`${apiBase}/api/invoices/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 422) {
        // Blocker present
        setBlockerMessage(data.error?.message || "Invoice blocked by client AP rules.");
        setBlockers(data.error?.details?.blockers || []);
        setAiReviewData(data.error?.details?.aiReview || null);
      } else if (!res.ok) {
        setGeneralError(data.error?.message || `Request failed with status ${res.status}`);
      } else {
        // Success 201 Created
        setSuccessData(data.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setGeneralError(`Connection failed: could not connect to backend server at ${apiBase} (${msg})`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetForm = () => {
    setSuccessData(null);
    setBlockers(null);
    setGeneralError(null);
    setPoNumber("");
    setLineItems([
      {
        id: "item-1",
        description: "Professional Web Development Services",
        quantity: 1,
        unitPrice: 150,
      },
    ]);
  };

  // Render Success Screen if Invoice was Created and Sent
  if (successData) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-pass/30 bg-card p-6 shadow-sm desk:p-8">
        <div className="flex items-center gap-3 text-pass">
          <div className="flex size-12 items-center justify-center rounded-full bg-pass-tint">
            <CheckCircle2 className="size-6 text-pass" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Cleared & Sent via PayPal Sandbox</h2>
            <p className="text-sm text-muted-foreground">PreFlight AI verified & PayPal invoice generated</p>
          </div>
        </div>

        <div className="mt-6 space-y-4 rounded-lg border bg-background/50 p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Invoice Number</p>
              <p className="font-semibold text-foreground">{successData.invoice_number}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <span className="inline-flex items-center rounded-full bg-pass-tint px-2.5 py-0.5 text-xs font-medium text-pass">
                Sent (Sandbox)
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PayPal Invoice ID</p>
              <p className="font-mono text-xs font-semibold text-foreground">{successData.paypal_invoice_id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Invoiced</p>
              <p className="font-semibold text-foreground">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: successData.currency,
                }).format(successData.total)}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Billed To</p>
              <p className="text-foreground">
                {successData.bill_to} <span className="text-muted-foreground">({successData.send_to})</span>
              </p>
            </div>
          </div>

          {successData.ai_review && successData.ai_review.summary && (
            <div className="border-t pt-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" />
                <span>AI Co-Pilot Assessment (Score: {successData.ai_review.score ?? 95}/100)</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{successData.ai_review.summary}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={successData.payer_view_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <span>Open PayPal Hosted Invoice Link</span>
            <ExternalLink className="size-4" />
          </a>

          <button
            type="button"
            onClick={handleResetForm}
            className="inline-flex items-center justify-center rounded-lg border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Blockers Alert Banner / Modal */}
      {blockers && blockers.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-blocker/30 bg-blocker-tint/80 p-5 shadow-sm transition-all"
        >
          <div className="flex items-start gap-3">
            <AlertOctagon className="mt-0.5 size-5 shrink-0 text-blocker" />
            <div className="flex-1">
              <h3 className="font-semibold text-blocker-strong">
                Pre-Flight Check: {blockerMessage || `${blockers.length} Blocker(s) Found`}
              </h3>
              <p className="mt-0.5 text-xs text-blocker-strong/80">
                This invoice cannot be sent until client accounts-payable blockers are resolved.
              </p>

              <div className="mt-3 space-y-2.5">
                {blockers.map((blocker) => (
                  <div
                    key={blocker.id}
                    className="flex flex-col gap-2 rounded-lg border border-blocker/25 bg-background p-3 text-sm shadow-2xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-foreground">{blocker.title}</p>
                      <p className="text-xs text-muted-foreground">{blocker.message}</p>
                      {blocker.evidence && (
                        <p className="mt-1 text-xs italic text-info-strong">
                          "From client AP doc: {blocker.evidence}"
                        </p>
                      )}
                    </div>
                    {blocker.fixLabel && (
                      <button
                        type="button"
                        onClick={() => handleQuickFix(blocker)}
                        className="inline-flex shrink-0 items-center gap-1 self-start rounded-md bg-blocker px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-blocker/90"
                      >
                        <Wand2 className="size-3" />
                        <span>{blocker.fixLabel}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {aiReviewData && Array.isArray(aiReviewData.recommendations) && aiReviewData.recommendations.length > 0 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">AI Recommendation:</span>{" "}
                  {aiReviewData.recommendations.join("; ")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* General Error Banner */}
      {generalError && (
        <div className="rounded-lg border border-blocker/30 bg-blocker-tint p-4 text-sm text-blocker-strong">
          <p className="font-medium">Error processing invoice</p>
          <p className="text-xs">{generalError}</p>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-6 shadow-sm desk:p-8">
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">New Invoice Generation</h1>
            <p className="text-xs text-muted-foreground">
              PreFlight checks against client AP rules and dispatches via PayPal Sandbox.
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-info-tint px-3 py-1 text-xs font-medium text-info-strong">
            <Sparkles className="size-3.5 text-info" />
            <span>AI AP Co-Pilot Active</span>
          </div>
        </div>

        {/* Client & Billing Info */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Client Name */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Building2 className="size-3.5 text-muted-foreground" />
              <span>Client Legal Name</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Corporation Ltd"
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <select
                aria-label="Select pre-configured client"
                onChange={(e) => handleClientPresetChange(e.target.value)}
                value={
                  clients.some((c) => c.name === clientName)
                    ? clientName
                    : CLIENT_PRESETS.some((p) => p.name === clientName)
                      ? clientName
                      : ""
                }
                className="rounded-lg border bg-background px-2.5 py-2 text-xs text-muted-foreground focus:border-primary focus:outline-none"
              >
                <option value="" disabled>
                  Presets
                </option>
                {clients.length > 0
                  ? clients.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} {c.requirements?.poRequired ? "(PO Required)" : "(PO Not Required)"}
                      </option>
                    ))
                  : CLIENT_PRESETS.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
              </select>
            </div>
          </div>

          {/* Send To Email */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Mail className="size-3.5 text-muted-foreground" />
              <span>Send To (AP Email)</span>
            </label>
            <input
              type="email"
              required
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder="ap@client.example"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Receipt className="size-3.5 text-muted-foreground" />
              <span>Currency</span>
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="USD">USD ($ - US Dollar)</option>
              <option value="EUR">EUR (€ - Euro)</option>
            </select>
          </div>

          {/* PO Number */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <FileCheck2 className="size-3.5 text-muted-foreground" />
                <span>Purchase Order (PO) Number</span>
              </label>
              {poRequired && !poNumber && (
                <span className="text-2xs font-semibold text-blocker">Required by AP rules</span>
              )}
              {!poRequired && (
                <span className="text-2xs font-medium text-muted-foreground">Not required</span>
              )}
            </div>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="e.g. PO-2026-04418"
              className={`w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none ${
                poRequired && !poNumber
                  ? "border-blocker/60 focus:border-blocker focus:ring-1 focus:ring-blocker"
                  : "focus:border-primary focus:ring-1 focus:ring-primary"
              }`}
            />
          </div>

          {/* Payment Terms */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Payment Terms</label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="Net 15">Net 15 (15 days)</option>
              <option value="Net 30">Net 30 (30 days)</option>
              <option value="Net 45">Net 45 (45 days)</option>
            </select>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Line Items & Deliverables</h2>
            <button
              type="button"
              onClick={handleAddLineItem}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-tint"
            >
              <Plus className="size-3.5" />
              <span>Add Line Item</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {lineItems.map((item, index) => (
              <div
                key={item.id}
                className="grid grid-cols-12 items-center gap-2 rounded-lg border bg-background/50 p-2.5 sm:gap-3"
              >
                <div className="col-span-12 sm:col-span-6">
                  <input
                    type="text"
                    required
                    placeholder="Deliverable description"
                    value={item.description}
                    onChange={(e) => handleItemChange(item.id, "description", e.target.value)}
                    className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(item.id, "quantity", Number(e.target.value))}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="col-span-5 sm:col-span-3">
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-xs text-muted-foreground">
                      {currency === "EUR" ? "€" : "$"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(item.id, "unitPrice", Number(e.target.value))}
                      className="w-full rounded-md border bg-background py-1.5 pr-2 pl-5 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <div className="col-span-3 flex justify-end sm:col-span-1">
                  <button
                    type="button"
                    disabled={lineItems.length <= 1}
                    onClick={() => handleRemoveLineItem(item.id)}
                    className="rounded p-1 text-muted-foreground hover:text-blocker disabled:cursor-not-allowed disabled:opacity-30"
                    title="Remove item"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Subtotal and Total */}
          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">Invoice Total:</span>
            <span className="font-mono text-base font-bold text-teal">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency,
              }).format(totalAmount)}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 border-t pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 px-4 font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Running Pre-Flight Checks & Generating via PayPal...</span>
              </>
            ) : (
              <>
                <Send className="size-4" />
                <span>Analyze & Send</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default InvoiceForm;
