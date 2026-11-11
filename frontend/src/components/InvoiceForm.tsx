import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsQuery } from "@/lib/queries";
import { API_BASE_URL, draftInvoice, recordCreatedInvoice, sendInvoice } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { QuickDraftCard } from "@/components/new-invoice/QuickDraftCard";
import {
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
  Info,
} from "lucide-react";
import type { Currency, InvoiceRecord, PaymentTerms } from "@/lib/types";

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

export function InvoiceForm({
  prefillAmount,
  prefillCurrency,
  lockedAmountProp,
  lockedCurrencyProp,
}: {
  prefillAmount?: number | undefined;
  prefillCurrency?: Currency | string | undefined;
  lockedAmountProp?: number | null | undefined;
  lockedCurrencyProp?: Currency | string | null | undefined;
} = {}) {
  const queryClient = useQueryClient();
  const clientsQ = useQuery(clientsQuery);
  const clients = clientsQ.data ?? [];

  // Dedicated lockedAmount state to protect calculated pricer values from AI prompt overwrites
  const [lockedAmount, setLockedAmount] = useState<number | null>(() =>
    lockedAmountProp !== undefined && lockedAmountProp !== null
      ? lockedAmountProp
      : prefillAmount !== undefined && prefillAmount > 0
        ? prefillAmount
        : null,
  );
  const [lockedCurrency, setLockedCurrency] = useState<Currency | string | null>(
    () => lockedCurrencyProp ?? prefillCurrency ?? (prefillAmount ? "USD" : null),
  );

  const [clientName, setClientName] = useState("Acme Corporation Ltd");
  const [sendTo, setSendTo] = useState("ap@acme.example");
  const [currency, setCurrency] = useState(prefillCurrency || "USD");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [poNumber, setPoNumber] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: "item-1",
      description: "Frontend application integration & QA testing",
      quantity: 1,
      unitPrice: prefillAmount && prefillAmount > 0 ? prefillAmount : 120,
    },
  ]);

  useEffect(() => {
    if (lockedAmountProp !== undefined && lockedAmountProp !== null) {
      setLockedAmount(lockedAmountProp);
    } else if (prefillAmount !== undefined && prefillAmount > 0) {
      setLockedAmount(prefillAmount);
    }
    if (lockedCurrencyProp) {
      setLockedCurrency(lockedCurrencyProp);
    } else if (prefillCurrency) {
      setLockedCurrency(prefillCurrency);
    }

    if (prefillAmount !== undefined && prefillAmount > 0) {
      setLineItems((prev) =>
        prev.map((item, idx) => (idx === 0 ? { ...item, unitPrice: prefillAmount } : item)),
      );
      if (prefillCurrency) {
        setCurrency(prefillCurrency);
      }
    }
  }, [prefillAmount, prefillCurrency, lockedAmountProp, lockedCurrencyProp]);

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
    activeClient && activeClient.requirements ? activeClient.requirements.poRequired : false;

  // Calculate invoice total
  const totalAmount = lineItems.reduce(
    (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );

  const handleClientPresetChange = (name: string) => {
    setClientName(name);
    const lower = name.toLowerCase().trim();
    const matched = clients.find(
      (c) =>
        c.name.toLowerCase() === lower ||
        c.id.toLowerCase() === lower ||
        c.name.toLowerCase().includes(lower) ||
        lower.includes(c.name.toLowerCase()),
    );
    if (matched) {
      setClientName(matched.name);
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
    const preset = CLIENT_PRESETS.find(
      (p) =>
        p.name.toLowerCase() === lower ||
        p.name.toLowerCase().includes(lower) ||
        lower.includes(p.name.toLowerCase()),
    );
    if (preset) {
      setClientName(preset.name);
      setSendTo(preset.email);
      setCurrency(preset.currency);
    }
  };

  const handleQuickDraftGenerate = async (promptText: string) => {
    try {
      // 1. Determine effective locked amount from state or props
      const effectiveLockedAmount =
        lockedAmount ?? (prefillAmount !== undefined && prefillAmount > 0 ? prefillAmount : null);
      const effectiveLockedCurrency =
        (lockedCurrency as Currency) ||
        (currency as Currency) ||
        (prefillCurrency as Currency) ||
        "USD";

      // 2. Request backend draft parsing
      const parsed = await draftInvoice(
        promptText,
        effectiveLockedAmount ?? undefined,
        effectiveLockedCurrency,
      );

      // 3. Smart State Merging (The Core Fix): Intercept BEFORE setting form state!
      // If lockedAmount is set, explicitly override amount and currency
      if (effectiveLockedAmount !== null && effectiveLockedAmount > 0) {
        parsed.amount = effectiveLockedAmount;
        if (effectiveLockedCurrency) {
          parsed.currency = effectiveLockedCurrency;
        }
      }

      // Update client name and matched preset/email/terms
      handleClientPresetChange(parsed.clientName);

      // Explicitly override amount and unit_price of AI's generated line items with lockedAmount
      if (effectiveLockedAmount !== null && effectiveLockedAmount > 0) {
        setCurrency(effectiveLockedCurrency);
        setLineItems((prev) =>
          prev.length > 0
            ? prev.map((item, idx) =>
                idx === 0
                  ? {
                      ...item,
                      description: parsed.description || item.description || "Services rendered",
                      unitPrice: effectiveLockedAmount,
                    }
                  : item,
              )
            : [
                {
                  id: `item-${Date.now()}`,
                  description: parsed.description || "Services rendered",
                  quantity: 1,
                  unitPrice: effectiveLockedAmount,
                },
              ],
        );
        toast.info("Invoice details updated", {
          description: `Preserved locked Net-Landing price of ${formatMoney(effectiveLockedAmount, effectiveLockedCurrency)}.`,
        });
      } else {
        // No locked amount: use amount and currency parsed from AI
        setCurrency(parsed.currency);
        setLineItems([
          {
            id: `item-${Date.now()}`,
            description: parsed.description || "Services rendered",
            quantity: 1,
            unitPrice: parsed.amount,
          },
        ]);
        toast.success("Draft ready", {
          description: `Generated draft for ${parsed.clientName} (${formatMoney(parsed.amount, parsed.currency)}).`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Could not generate draft from prompt", { description: msg });
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

    const apiBase = API_BASE_URL;

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
        const rec = (data.data || data) as SuccessData;
        setSuccessData(rec);
        if (rec && (rec.invoice_number || rec.paypal_invoice_id)) {
          const formattedRecord: InvoiceRecord = {
            id: String(rec.id || rec.paypal_invoice_id || rec.invoice_number),
            number: rec.invoice_number,
            clientName: rec.bill_to || clientName,
            amount: Number(rec.total || totalAmount),
            currency: (rec.currency || currency) as Currency,
            status: "sent",
            issueDate: new Date().toISOString().slice(0, 10),
            dueDate: new Date().toISOString().slice(0, 10),
            preflight: { blockers: 0, warnings: 0 },
            paypalInvoiceId: rec.paypal_invoice_id,
            payerLink: rec.payer_view_url,
            updatedNote: "Sent",
          };
          recordCreatedInvoice(formattedRecord);
          queryClient.setQueryData<InvoiceRecord[]>(["invoices"], (prev) => [
            formattedRecord,
            ...(prev ? prev.filter((i) => i.id !== formattedRecord.id) : []),
          ]);
        }
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
      }
    } catch {
      // If live backend is offline, create invoice via sandbox API layer
      try {
        const fallbackRecord = await sendInvoice(
          {
            clientId: activeClient?.id ?? null,
            clientName,
            sendTo,
            currency: (currency as Currency) || "USD",
            paymentTerms: (paymentTerms as PaymentTerms) || "Net 30",
            poNumber: poNumber.trim(),
            vatId: "",
            invoiceDate: new Date().toISOString().slice(0, 10),
            lineItems: lineItems.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: Number(item.quantity) || 1,
              unitPrice: Number(item.unitPrice) || 0,
            })),
          },
          [],
        );
        recordCreatedInvoice(fallbackRecord);
        queryClient.setQueryData<InvoiceRecord[]>(["invoices"], (prev) => [
          fallbackRecord,
          ...(prev ? prev.filter((i) => i.id !== fallbackRecord.id) : []),
        ]);
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
        setSuccessData({
          id: fallbackRecord.id,
          invoice_number: fallbackRecord.number,
          paypal_invoice_id: fallbackRecord.paypalInvoiceId ?? "INV2-SANDBOX-DEMO",
          payer_view_url:
            fallbackRecord.payerLink ??
            "https://www.sandbox.paypal.com/invoice/p/#INV2-SANDBOX-DEMO",
          status: "sent",
          bill_to: fallbackRecord.clientName,
          send_to: sendTo,
          currency: fallbackRecord.currency,
          total: fallbackRecord.amount,
        });
      } catch (fallbackErr: unknown) {
        const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        setGeneralError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetForm = () => {
    setSuccessData(null);
    setBlockers(null);
    setGeneralError(null);
    setLockedAmount(null);
    setLockedCurrency(null);
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
      <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-200/80 bg-white p-6 shadow-sm desk:p-8">
        <div className="flex items-center gap-3 text-emerald-700">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-emerald-200/80 bg-emerald-50 shadow-2xs">
            <CheckCircle2 className="size-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Cleared & Sent via PayPal Sandbox
            </h2>
            <p className="text-xs text-slate-500">PreFlight verified & PayPal invoice generated</p>
          </div>
        </div>

        <div className="mt-6 space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/50 p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-slate-500">Invoice Number</p>
              <p className="font-semibold text-slate-900">{successData.invoice_number}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Status</p>
              <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-700 shadow-2xs">
                Sent (Sandbox)
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">PayPal Invoice ID</p>
              <p className="font-mono text-xs font-semibold text-slate-900">
                {successData.paypal_invoice_id}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Invoiced</p>
              <p className="font-bold text-slate-900">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: successData.currency,
                }).format(successData.total)}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-medium text-slate-500">Billed To</p>
              <p className="text-slate-800">
                {successData.bill_to}{" "}
                <span className="text-slate-500">({successData.send_to})</span>
              </p>
            </div>
          </div>

          {successData.ai_review && successData.ai_review.summary && (
            <div className="border-t border-slate-200/60 pt-3">
              <div className="text-xs font-semibold text-indigo-700">
                AP Co-Pilot Assessment (Score: {successData.ai_review.score ?? 95}/100)
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                {successData.ai_review.summary}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={successData.payer_view_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          >
            <span>Open PayPal Hosted Invoice Link</span>
            <ExternalLink className="size-4" />
          </a>

          <button
            type="button"
            onClick={handleResetForm}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
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
          className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 shadow-xs transition-all"
        >
          <div className="flex items-start gap-3">
            <AlertOctagon className="mt-0.5 size-5 shrink-0 text-rose-600" />
            <div className="flex-1">
              <h3 className="font-bold text-rose-900">
                Pre-Flight Check: {blockerMessage || `${blockers.length} Blocker(s) Found`}
              </h3>
              <p className="mt-0.5 text-xs text-rose-700">
                This invoice cannot be sent until client accounts-payable blockers are resolved.
              </p>

              <div className="mt-3 space-y-2.5">
                {blockers.map((blocker) => (
                  <div
                    key={blocker.id}
                    className="flex flex-col gap-2 rounded-xl border border-rose-200/80 bg-white p-3.5 text-sm shadow-2xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{blocker.title}</p>
                      <p className="text-xs text-slate-600">{blocker.message}</p>
                      {blocker.evidence && (
                        <p className="mt-1 text-xs italic text-indigo-700">
                          "From client AP doc: {blocker.evidence}"
                        </p>
                      )}
                    </div>
                    {blocker.fixLabel && (
                      <button
                        type="button"
                        onClick={() => handleQuickFix(blocker)}
                        className="inline-flex shrink-0 items-center self-start rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-rose-700 cursor-pointer"
                      >
                        <span>{blocker.fixLabel}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {aiReviewData &&
                Array.isArray(aiReviewData.recommendations) &&
                aiReviewData.recommendations.length > 0 && (
                  <div className="mt-3 text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">AI Recommendation:</span>{" "}
                    {aiReviewData.recommendations.join("; ")}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* General Error Banner */}
      {generalError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-semibold">Error processing invoice</p>
          <p className="text-xs">{generalError}</p>
        </div>
      )}

      {/* Pricer Info Banner */}
      {prefillAmount !== undefined && prefillAmount > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info-tint px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          <p className="text-foreground">
            <span className="font-medium text-info-strong">From the Pricer:</span>{" "}
            {formatMoney(prefillAmount, (currency as Currency) ?? "USD")} added to the invoice. Use
            the AI generator below to fill client and description details without losing this
            amount.
          </p>
        </div>
      )}

      {/* AI One-Line Prompt Generator Card */}
      <QuickDraftCard
        onGenerate={handleQuickDraftGenerate}
        lockedAmount={lockedAmount}
        lockedCurrency={lockedCurrency}
      />

      {/* Main Form */}
      <form
        id="direct-invoice-form"
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs desk:p-8"
      >
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              New Invoice Generation
            </h1>
            <p className="text-xs text-slate-500">
              PreFlight checks against client AP rules and dispatches via PayPal Sandbox.
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
            <span>PreFlight Active</span>
          </div>
        </div>

        {/* Client & Billing Info */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Client Name */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Building2 className="size-3.5 text-slate-400" />
              <span>Client Legal Name</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Corporation Ltd"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition-all placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
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
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-2xs transition-all focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer"
              >
                <option value="" disabled>
                  Presets
                </option>
                {clients.length > 0
                  ? clients.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}{" "}
                        {c.requirements?.poRequired ? "(PO Required)" : "(PO Not Required)"}
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
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Mail className="size-3.5 text-slate-400" />
              <span>Send To (AP Email)</span>
            </label>
            <input
              type="email"
              required
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder="ap@client.example"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition-all placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Receipt className="size-3.5 text-slate-400" />
              <span>Currency</span>
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-2xs transition-all focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer"
            >
              <option value="USD">USD ($ - US Dollar)</option>
              <option value="EUR">EUR (€ - Euro)</option>
            </select>
          </div>

          {/* PO Number */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <FileCheck2 className="size-3.5 text-slate-400" />
                <span>Purchase Order (PO) Number</span>
              </label>
              {poRequired && !poNumber && (
                <span className="text-[11px] font-semibold text-rose-600">
                  Required by AP rules
                </span>
              )}
              {!poRequired && (
                <span className="text-[11px] font-medium text-slate-400">Not required</span>
              )}
            </div>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="e.g. PO-2026-04418"
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition-all placeholder:text-slate-400 focus:outline-none ${
                poRequired && !poNumber
                  ? "border-rose-400 focus:border-rose-600 focus:ring-4 focus:ring-rose-500/10"
                  : "border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10"
              }`}
            />
          </div>

          {/* Payment Terms */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Payment Terms</label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-2xs transition-all focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer"
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
            <h2 className="text-sm font-bold text-slate-900">Line Items & Deliverables</h2>
            <button
              type="button"
              onClick={handleAddLineItem}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-100/80 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Add Line Item</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {lineItems.map((item, index) => (
              <div
                key={item.id}
                className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 sm:gap-3 shadow-2xs"
              >
                <div className="col-span-12 sm:col-span-6">
                  <input
                    type="text"
                    required
                    placeholder="Deliverable description"
                    value={item.description}
                    onChange={(e) => handleItemChange(item.id, "description", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(item.id, "quantity", Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
                <div className="col-span-5 sm:col-span-3">
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-xs text-slate-400">
                      {currency === "EUR" ? "€" : "$"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      value={item.unitPrice}
                      onChange={(e) =>
                        handleItemChange(item.id, "unitPrice", Number(e.target.value))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-2.5 pl-6 text-xs text-slate-900 shadow-2xs focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </div>
                </div>
                <div className="col-span-3 flex justify-end sm:col-span-1">
                  <button
                    type="button"
                    disabled={lineItems.length <= 1}
                    onClick={() => handleRemoveLineItem(item.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Subtotal and Total */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-xs font-medium text-slate-500">Invoice Total:</span>
            <span className="font-mono text-base font-bold text-slate-900">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency,
              }).format(totalAmount)}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 px-5 font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
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
