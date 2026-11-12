import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Loader2, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/preflight/PageHeader";
import { DraftInvoiceForm } from "@/components/new-invoice/DraftInvoiceForm";
import { InvoicePreviewDialog } from "@/components/new-invoice/InvoicePreviewDialog";
import { PreflightPanel } from "@/components/new-invoice/PreflightPanel";
import { QuickDraftCard } from "@/components/new-invoice/QuickDraftCard";
import { InvoiceForm } from "@/components/InvoiceForm";
import { demoDraft, emptyDraft, newLineItem } from "@/components/new-invoice/draft-utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { draftInvoice, recordCreatedInvoice, runPreflight, sendInvoice } from "@/lib/api";
import { formatMoney, invoiceTotal, pluralize, todayIso } from "@/lib/format";
import { applyFix, preflight, summarize } from "@/lib/preflight";
import { calcPricing } from "@/lib/pricer";
import { clientsQuery } from "@/lib/queries";
import { useInvoices } from "@/context/InvoicesContext";
import { MOCK_CLIENTS } from "@/mocks/clients";
import {
  CURRENCIES,
  type Currency,
  type DraftInvoice,
  type FixField,
  type InvoiceRecord,
  type Issue,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface NewInvoiceSearch {
  amount?: number | undefined;
  currency?: Currency | undefined;
  targetNet?: number | undefined;
  userCurrency?: Currency | undefined;
}

export const Route = createFileRoute("/app/new-invoice")({
  validateSearch: (search: Record<string, unknown>): NewInvoiceSearch => {
    const amount = Number(search["amount"]);
    const currency = search["currency"] as string | undefined;
    const targetNet = Number(search["targetNet"]);
    const userCurrency = search["userCurrency"] as string | undefined;
    return {
      amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
      currency:
        currency && CURRENCIES.includes(currency as Currency) ? (currency as Currency) : undefined,
      targetNet: Number.isFinite(targetNet) && targetNet > 0 ? targetNet : undefined,
      userCurrency:
        userCurrency && CURRENCIES.includes(userCurrency as Currency)
          ? (userCurrency as Currency)
          : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "New invoice · PreFlight" },
      {
        name: "description",
        content:
          "Draft an invoice in one line and check it against the client's AP rules before sending.",
      },
      { property: "og:title", content: "New invoice · PreFlight" },
      {
        property: "og:description",
        content:
          "Draft an invoice in one line and check it against the client's AP rules before sending.",
      },
    ],
  }),
  component: NewInvoicePage,
});

function NewInvoicePage() {
  const { addInvoice } = useInvoices();
  const [viewMode, setViewMode] = useState<"split" | "form">("split");
  const {
    amount: prefillAmount,
    currency: prefillCurrency,
    targetNet: prefillTargetNet,
    userCurrency: prefillUserCurrency,
  } = Route.useSearch();
  const queryClient = useQueryClient();
  const clientsQ = useQuery(clientsQuery);
  const clients = clientsQ.data && clientsQ.data.length > 0 ? clientsQ.data : MOCK_CLIENTS;

  // Track the original target net amount and user currency to enable accurate recalculations on currency switch
  const [targetNet, setTargetNet] = useState<number | null>(() =>
    prefillTargetNet !== undefined && prefillTargetNet > 0 ? prefillTargetNet : null,
  );
  const [userCurrency, setUserCurrency] = useState<Currency>(() => prefillUserCurrency ?? "USD");

  // Specific state for preserving and locking net-landing pricer calculations
  const [lockedAmount, setLockedAmount] = useState<number | null>(() =>
    prefillAmount !== undefined && prefillAmount > 0 ? prefillAmount : null,
  );
  const [lockedCurrency, setLockedCurrency] = useState<Currency | string | null>(
    () => prefillCurrency ?? (prefillAmount ? "USD" : null),
  );

  const [draft, setDraft] = useState<DraftInvoice>(() =>
    demoDraft({ amount: prefillAmount, currency: prefillCurrency }),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [sent, setSent] = useState<InvoiceRecord | null>(null);
  const [flash, setFlash] = useState<{ field: FixField; lineId?: string | undefined } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  // Synchronize locked amount & draft line item when navigated from Pricer
  useEffect(() => {
    if (prefillTargetNet !== undefined && prefillTargetNet > 0) {
      setTargetNet(prefillTargetNet);
    }
    if (prefillUserCurrency) {
      setUserCurrency(prefillUserCurrency);
    }
    if (prefillAmount !== undefined && prefillAmount > 0) {
      setLockedAmount(prefillAmount);
      if (prefillCurrency) setLockedCurrency(prefillCurrency);
      setDraft((prev: DraftInvoice) => ({
        ...prev,
        currency: prefillCurrency ?? prev.currency,
        lineItems:
          prev.lineItems.length > 0
            ? prev.lineItems.map((li, idx) =>
                idx === 0 ? { ...li, unitPrice: prefillAmount } : li,
              )
            : [
                newLineItem({
                  description: "Services rendered",
                  quantity: 1,
                  unitPrice: prefillAmount,
                }),
              ],
      }));
    }
  }, [prefillAmount, prefillCurrency, prefillTargetNet, prefillUserCurrency]);

  const client =
    clients.find((c) => c.id === draft.clientId) ??
    MOCK_CLIENTS.find((c) => c.id === draft.clientId) ??
    null;
  const requirements = client?.requirements ?? null;

  // Compute local issues instantly to guarantee preflight checking never hangs indefinitely
  const localIssues = useMemo(
    () => (requirements ? preflight(draft, requirements) : undefined),
    [requirements, draft],
  );

  // Live pre-flight: debounce form edits, then run the rules with immediate local fallback
  const debouncedDraft = useDebouncedValue(draft, 300);
  const preflightQ = useQuery({
    queryKey: ["preflight", client?.id, requirements, debouncedDraft],
    queryFn: () => runPreflight(debouncedDraft, client!.id),
    enabled: Boolean(requirements && client?.id),
    placeholderData: keepPreviousData,
    initialData: localIssues,
    staleTime: 3000,
    retry: false,
  });

  const issues = requirements ? (preflightQ.data ?? localIssues) : undefined;
  const checking =
    isChecking ||
    (Boolean(requirements && client?.id) &&
      debouncedDraft !== draft &&
      preflightQ.isFetching &&
      !preflightQ.isError);
  const summary = useMemo(() => (issues ? summarize(issues) : null), [issues]);

  const total = invoiceTotal(draft);
  const canSend = Boolean(
    summary &&
      summary.blockers === 0 &&
      total > 0 &&
      !sendMutation.isPending &&
      !isGenerating &&
      !sent,
  );

  const sendMutation = useMutation({
    mutationFn: () => sendInvoice(draft, issues ?? []),
    onSuccess: (record) => {
      setSent(record);
      addInvoice(record);
      toast.success("Invoice sent in PayPal Sandbox", {
        description: `${record.number} · ${formatMoney(record.amount, record.currency)} to ${draft.sendTo || record.clientName}`,
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not send the invoice."),
  });

  async function handleGenerate(text: string) {
    setIsGenerating(true);
    setIsChecking(true);
    try {
      const effectiveLockedAmount =
        lockedAmount ?? (prefillAmount !== undefined && prefillAmount > 0 ? prefillAmount : null);
      const effectiveLockedCurrency =
        (lockedCurrency as Currency) || (draft.currency as Currency) || prefillCurrency || "USD";

      // Send to backend with locked amount instruction
      const parsed = await draftInvoice(
        text,
        effectiveLockedAmount ?? undefined,
        effectiveLockedCurrency,
      );

      // Smart State Merging (Core Fix): Intercept parsed response BEFORE setting form state!
      // If lockedAmount is set, forcefully override parsed.amount with lockedAmount
      if (effectiveLockedAmount !== null && effectiveLockedAmount > 0) {
        parsed.amount = effectiveLockedAmount;
        if (effectiveLockedCurrency) {
          parsed.currency = effectiveLockedCurrency;
        }
      }

      const matched = clients.find((c) => c.id === parsed.clientId);
      setSent(null);

      // Forcefully retain the locked amount in line items
      setDraft((prev: DraftInvoice) => {
        const finalCurrency =
          effectiveLockedAmount !== null && effectiveLockedAmount > 0
            ? prev.currency || effectiveLockedCurrency
            : parsed.currency;
        const lineItemUnitPrice =
          effectiveLockedAmount !== null && effectiveLockedAmount > 0
            ? effectiveLockedAmount
            : parsed.amount;

        const updatedLineItems =
          prev.lineItems.length > 0
            ? prev.lineItems.map((li, idx) =>
                idx === 0
                  ? {
                      ...li,
                      description: parsed.description || li.description || "Services rendered",
                      unitPrice: lineItemUnitPrice,
                    }
                  : li,
              )
            : [
                newLineItem({
                  description: parsed.description || "Services rendered",
                  quantity: 1,
                  unitPrice: lineItemUnitPrice,
                }),
              ];

        return {
          ...prev,
          clientId: parsed.clientId,
          clientName: parsed.clientName,
          sendTo: matched?.contactEmail ?? prev.sendTo,
          currency: finalCurrency,
          poNumber: prev.poNumber,
          vatId: prev.vatId,
          invoiceDate: prev.invoiceDate || todayIso(),
          lineItems: updatedLineItems,
        };
      });

      toast.success("Draft ready", {
        description: matched
          ? `Checking against ${matched.name}'s AP rules.${
              effectiveLockedAmount !== null && effectiveLockedAmount > 0
                ? ` Net-Landing price locked at ${formatMoney(effectiveLockedAmount, effectiveLockedCurrency)}.`
                : ""
            }`
          : `Draft ready.${
              effectiveLockedAmount !== null && effectiveLockedAmount > 0
                ? ` Net-Landing price locked at ${formatMoney(effectiveLockedAmount, effectiveLockedCurrency)}.`
                : ""
            }`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Could not generate draft from prompt", { description: msg });
    } finally {
      setIsGenerating(false);
      setIsChecking(false);
    }
  }

  function handleClientChange(clientId: string) {
    const next = clients.find((c) => c.id === clientId);
    const prev = clients.find((c) => c.id === draft.clientId);
    setDraft((d: DraftInvoice) => ({
      ...d,
      clientId,
      clientName:
        !d.clientName.trim() || d.clientName === prev?.name ? (next?.name ?? "") : d.clientName,
      sendTo:
        !d.sendTo.trim() || d.sendTo === prev?.contactEmail ? (next?.contactEmail ?? "") : d.sendTo,
    }));
  }

  function handleFix(issue: Issue) {
    if (issue.fixField === "currency") {
      const nextCurrency = (issue.fixValue as Currency) || "USD";
      if (targetNet && targetNet > 0) {
        // Re-trigger the Pricer calculation utility to compute new gross based on original target net
        const pricing = calcPricing({
          targetNet,
          currency: userCurrency,
          clientCurrency: nextCurrency,
          crossCurrency: userCurrency !== nextCurrency,
        });
        const newGross = pricing.invoiceAmount;

        setDraft((prev: DraftInvoice) => ({
          ...prev,
          currency: nextCurrency,
          lineItems:
            prev.lineItems.length > 0
              ? prev.lineItems.map((li, idx) =>
                  idx === 0 ? { ...li, unitPrice: newGross } : li,
                )
              : [
                  newLineItem({
                    description: "Services rendered",
                    quantity: 1,
                    unitPrice: newGross,
                  }),
                ],
        }));
        setLockedAmount(newGross);
        setLockedCurrency(nextCurrency);
        toast.info(`Switched currency to ${nextCurrency}`, {
          description: `Recalculated gross amount to ${formatMoney(newGross, nextCurrency)} to guarantee ${formatMoney(targetNet, userCurrency)} net in pocket.`,
        });
      } else {
        // Original target amount isn't available in scope:
        // Update currency and automatically clear Line Items / Total
        setDraft((prev: DraftInvoice) => ({
          ...prev,
          currency: nextCurrency,
          lineItems: prev.lineItems.map((li) => ({ ...li, unitPrice: 0 })),
        }));
        setLockedAmount(null);
        setLockedCurrency(null);
        toast.warning(`Switched currency to ${nextCurrency}`, {
          description:
            "Line item amounts cleared. Please use the Net-Landing Pricer to recalculate the exact gross amount.",
        });
      }
    } else {
      setDraft((d: DraftInvoice) => applyFix(d, issue));
    }

    if (issue.fixField) {
      setFlash({ field: issue.fixField, lineId: issue.fixTargetId });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 1400);
    }
  }

  function handleStartNew() {
    setSent(null);
    setLockedAmount(null);
    setLockedCurrency(null);
    setTargetNet(null);
    setDraft(emptyDraft());
  }

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="New invoice"
        subtitle="Describe the invoice in one line. PreFlight checks it against the client's AP rules before it goes out."
        actions={
          <div className="flex items-center gap-2.5">
            <InvoicePreviewDialog draft={draft} summary={summary} />
            <Button
              type="button"
              onClick={() => {
                if (canSend && !sendMutation.isPending) {
                  sendMutation.mutate();
                }
              }}
              disabled={!canSend || sendMutation.isPending}
              className={cn(
                "rounded-xl font-semibold transition-all duration-200 px-4 py-2 text-sm",
                canSend
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm border border-emerald-500/50 cursor-pointer active:scale-[0.98]"
                  : "border border-slate-700/80 bg-slate-800/80 text-slate-400 shadow-none cursor-not-allowed",
              )}
              aria-label={
                summary && summary.blockers > 0
                  ? `Send via PayPal, locked: resolve ${pluralize(summary.blockers, "blocker")} first`
                  : total <= 0
                    ? "Enter a line item amount to send"
                    : "Send via PayPal"
              }
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin shrink-0" aria-hidden="true" />
                  Sending via PayPal...
                </>
              ) : canSend ? (
                <>
                  <Send className="size-4 shrink-0" aria-hidden="true" />
                  Send via PayPal
                </>
              ) : (
                <>
                  <Lock className="size-4 shrink-0" aria-hidden="true" />
                  Send via PayPal
                </>
              )}
            </Button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 desk:px-8 desk:py-8 space-y-6 flex-1">
        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-100 p-1.5 w-fit shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode("form")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 cursor-pointer ${
              viewMode === "form"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Direct Invoice Generator (API)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("split")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 cursor-pointer ${
              viewMode === "split"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Live Pre-Flight Split View
          </button>
        </div>

        {viewMode === "form" ? (
          <InvoiceForm
            prefillAmount={prefillAmount}
            prefillCurrency={prefillCurrency}
            targetNetProp={targetNet}
            userCurrencyProp={userCurrency}
            lockedAmountProp={lockedAmount}
            lockedCurrencyProp={lockedCurrency}
          />
        ) : (
          <>
            {prefillAmount && (
              <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info-tint px-4 py-3 text-sm">
                <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
                <p className="text-foreground">
                  <span className="font-medium text-info-strong">From the Pricer:</span>{" "}
                  {formatMoney(prefillAmount, prefillCurrency ?? "USD")} added as the line item
                  amount. Check the client and describe the work.
                </p>
              </div>
            )}

            <QuickDraftCard
              onGenerate={handleGenerate}
              lockedAmount={lockedAmount}
              lockedCurrency={lockedCurrency}
              isGenerating={isGenerating}
            />

            <div className="grid grid-cols-1 items-start gap-6 wide:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <DraftInvoiceForm
                draft={draft}
                clients={clients}
                clientsLoading={clientsQ.isPending}
                onChange={setDraft}
                onClientChange={handleClientChange}
                flashField={flash?.field ?? null}
                flashLineId={flash?.lineId}
              />
              <PreflightPanel
                client={client}
                clientsLoading={clientsQ.isPending && draft.clientId !== null}
                issues={issues}
                checking={checking}
                sending={sendMutation.isPending}
                sent={sent}
                canSend={canSend}
                total={total}
                onFix={handleFix}
                onSend={() => {
                  if (canSend && !sendMutation.isPending) {
                    sendMutation.mutate();
                  }
                }}
                onStartNew={handleStartNew}
              />
            </div>
            {clientsQ.isError && (
              <p role="alert" className="text-sm text-blocker-strong">
                Could not load clients. Refresh the page to try again.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
