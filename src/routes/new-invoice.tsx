import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/preflight/PageHeader";
import { DraftInvoiceForm } from "@/components/new-invoice/DraftInvoiceForm";
import { InvoicePreviewDialog } from "@/components/new-invoice/InvoicePreviewDialog";
import { PreflightPanel } from "@/components/new-invoice/PreflightPanel";
import { QuickDraftCard } from "@/components/new-invoice/QuickDraftCard";
import { emptyDraft, newLineItem } from "@/components/new-invoice/draft-utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { runPreflight, sendInvoice } from "@/lib/api";
import { formatMoney, pluralize, todayIso } from "@/lib/format";
import { parseDraftPrompt } from "@/lib/parse-draft";
import { applyFix, summarize } from "@/lib/preflight";
import { clientsQuery } from "@/lib/queries";
import type { Currency, DraftInvoice, FixField, InvoiceRecord, Issue } from "@/lib/types";

interface NewInvoiceSearch {
  amount?: number;
  currency?: Currency;
}

export const Route = createFileRoute("/new-invoice")({
  validateSearch: (search: Record<string, unknown>): NewInvoiceSearch => {
    const amount = Number(search.amount);
    return {
      amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
      currency: search.currency === "USD" || search.currency === "EUR" ? search.currency : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "New invoice · PreFlight" },
      {
        name: "description",
        content: "Draft an invoice in one line and check it against the client's AP rules before sending.",
      },
      { property: "og:title", content: "New invoice · PreFlight" },
      {
        property: "og:description",
        content: "Draft an invoice in one line and check it against the client's AP rules before sending.",
      },
    ],
  }),
  component: NewInvoicePage,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function NewInvoicePage() {
  const { amount: prefillAmount, currency: prefillCurrency } = Route.useSearch();
  const queryClient = useQueryClient();
  const clientsQ = useQuery(clientsQuery);
  const clients = clientsQ.data ?? [];

  const [draft, setDraft] = useState<DraftInvoice>(() =>
    emptyDraft({ amount: prefillAmount, currency: prefillCurrency }),
  );
  const [sent, setSent] = useState<InvoiceRecord | null>(null);
  const [flash, setFlash] = useState<{ field: FixField; lineId?: string } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const client = clients.find((c) => c.id === draft.clientId) ?? null;
  const requirements = client?.requirements ?? null;

  // Live pre-flight: debounce form edits, then run the rules.
  const debouncedDraft = useDebouncedValue(draft, 300);
  const preflightQ = useQuery({
    queryKey: ["preflight", client?.id, requirements, debouncedDraft],
    queryFn: () => runPreflight(debouncedDraft, requirements!),
    enabled: Boolean(requirements),
    placeholderData: keepPreviousData,
  });
  const issues = requirements ? preflightQ.data : undefined;
  const checking = Boolean(requirements) && (debouncedDraft !== draft || preflightQ.isFetching);
  const summary = useMemo(() => (issues ? summarize(issues) : null), [issues]);

  const canSend = Boolean(summary && summary.blockers === 0 && !checking && !sent);

  const sendMutation = useMutation({
    mutationFn: () => sendInvoice(draft, issues ?? []),
    onSuccess: (record) => {
      setSent(record);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice sent in PayPal Sandbox", {
        description: `${record.number} · ${formatMoney(record.amount, record.currency)} to ${draft.sendTo || record.clientName}`,
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send the invoice."),
  });

  async function handleGenerate(text: string) {
    await sleep(600);
    const parsed = parseDraftPrompt(text, clients);
    const matched = clients.find((c) => c.id === parsed.clientId);
    setSent(null);
    setDraft((prev) => ({
      ...prev,
      clientId: parsed.clientId,
      clientName: parsed.clientName,
      sendTo: matched?.contactEmail ?? "",
      currency: parsed.currency,
      poNumber: "",
      vatId: "",
      invoiceDate: todayIso(),
      lineItems: [newLineItem({ description: parsed.description, quantity: 1, unitPrice: parsed.amount })],
    }));
    toast("Draft ready", {
      description: matched
        ? `Checking against ${matched.name}'s AP rules.`
        : "No matching client found. Choose a client account to run pre-flight.",
    });
  }

  function handleClientChange(clientId: string) {
    const next = clients.find((c) => c.id === clientId);
    const prev = clients.find((c) => c.id === draft.clientId);
    setDraft((d) => ({
      ...d,
      clientId,
      clientName: !d.clientName.trim() || d.clientName === prev?.name ? (next?.name ?? "") : d.clientName,
      sendTo: !d.sendTo.trim() || d.sendTo === prev?.contactEmail ? (next?.contactEmail ?? "") : d.sendTo,
    }));
  }

  function handleFix(issue: Issue) {
    setDraft((d) => applyFix(d, issue));
    if (issue.fixField) {
      setFlash({ field: issue.fixField, lineId: issue.fixTargetId });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 1400);
    }
  }

  function handleStartNew() {
    setSent(null);
    setDraft(emptyDraft());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New invoice"
        subtitle="Describe the invoice in one line. PreFlight checks it against the client's AP rules before it goes out."
        actions={
          <>
            <InvoicePreviewDialog draft={draft} summary={summary} />
            <Button
              type="button"
              onClick={() => sendMutation.mutate()}
              disabled={!canSend || sendMutation.isPending}
              aria-label={
                summary && summary.blockers > 0
                  ? `Send via PayPal, locked: resolve ${pluralize(summary.blockers, "blocker")} first`
                  : "Send via PayPal"
              }
            >
              {canSend ? <Send aria-hidden="true" /> : <Lock aria-hidden="true" />}
              Send via PayPal
            </Button>
          </>
        }
      />

      {prefillAmount && (
        <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info-tint px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          <p className="text-foreground">
            <span className="font-medium text-info-strong">From the Pricer:</span>{" "}
            {formatMoney(prefillAmount, prefillCurrency ?? "USD")} added as the first line item. Choose a
            client and describe the work.
          </p>
        </div>
      )}

      <QuickDraftCard onGenerate={handleGenerate} />

      <div className="grid items-start gap-6 wide:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
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
          onFix={handleFix}
          onSend={() => sendMutation.mutate()}
          onStartNew={handleStartNew}
        />
      </div>
      {clientsQ.isError && (
        <p role="alert" className="text-sm text-blocker-strong">
          Could not load clients. Refresh the page to try again.
        </p>
      )}
    </div>
  );
}
