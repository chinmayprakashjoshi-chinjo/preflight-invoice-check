import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock,
  FilePlus2,
  FileStack,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/preflight/EmptyState";
import { KpiCard } from "@/components/preflight/KpiCard";
import { PageHeader } from "@/components/preflight/PageHeader";
import { STATUS_LABELS } from "@/components/preflight/StatusChip";
import { markPaid } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { invoicesQuery } from "@/lib/queries";
import {
  InvoiceStatusSchema,
  type Currency,
  type InvoiceRecord,
  type InvoiceStatus,
} from "@/lib/types";

const InvoicesGrid = lazy(() => import("@/components/invoices/InvoicesGrid"));

export const Route = createFileRoute("/app/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices · PreFlight" },
      {
        name: "description",
        content: "Every invoice you have drafted and sent, with its status and pre-flight result.",
      },
      { property: "og:title", content: "Invoices · PreFlight" },
      {
        property: "og:description",
        content: "Every invoice you have drafted and sent, with its status and pre-flight result.",
      },
    ],
  }),
  component: InvoicesPage,
});

type StatusFilter = InvoiceStatus | "all";

function totalsByCurrency(rows: InvoiceRecord[]): string[] {
  const sums = new Map<Currency, number>();
  for (const r of rows) sums.set(r.currency, (sums.get(r.currency) ?? 0) + r.amount);
  return [...sums.entries()].map(([c, v]) => formatMoney(v, c));
}

function GridSkeleton() {
  return (
    <div
      className="space-y-2 rounded-xl border bg-surface p-4"
      aria-busy="true"
      aria-label="Loading invoices"
    >
      <Skeleton className="h-9 w-full" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fetchLiveInvoices = async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/invoices`);
      if (!res.ok) {
        throw new Error(`Failed to load invoices (${res.status})`);
      }
      const data = await res.json();
      const rawInvoices: any[] = Array.isArray(data) ? data : data.invoices || [];

      const today = new Date().toISOString().slice(0, 10);
      const mapped: InvoiceRecord[] = rawInvoices.map((inv: any) => {
        const isOverdue = inv.status === "sent" && (inv.due_date || inv.dueDate) < today;
        return {
          id: inv.id,
          number: inv.invoice_number || inv.number || "INV-UNKNOWN",
          clientName: inv.bill_to || inv.clientName || "Valued Client",
          amount: Number(inv.total ?? inv.amount ?? 0),
          currency: (inv.currency || "USD") as Currency,
          status: (isOverdue ? "overdue" : inv.status || "sent") as InvoiceStatus,
          issueDate: inv.invoice_date || inv.issueDate || today,
          dueDate: inv.due_date || inv.dueDate || today,
          preflight: inv.preflight_summary || inv.preflight || { blockers: 0, warnings: 0 },
          paypalInvoiceId: inv.paypal_invoice_id || inv.paypalInvoiceId,
          payerLink:
            inv.payer_view_url ||
            inv.payerLink ||
            (inv.paypal_invoice_id
              ? `https://www.sandbox.paypal.com/invoice/p/#${inv.paypal_invoice_id}`
              : undefined),
          updatedNote: inv.status === "paid" ? "Paid" : "Sent",
        };
      });

      setInvoices(mapped);
    } catch (err) {
      console.error("[InvoicesPage] Failed to fetch invoices:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveInvoices();
  }, []);

  const kpis = useMemo(() => {
    const by = (s: InvoiceStatus) => invoices.filter((i) => i.status === s);
    return {
      draft: by("draft"),
      sent: by("sent"),
      paid: by("paid"),
      overdue: by("overdue"),
    };
  }, [invoices]);

  const rows = useMemo(
    () => (status === "all" ? invoices : invoices.filter((i) => i.status === status)),
    [invoices, status],
  );

  const paidMutation = useMutation({
    mutationFn: (inv: InvoiceRecord) => markPaid(inv.id),
    onMutate: (inv) => setPendingId(inv.id),
    onSuccess: (updated) => {
      setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      toast.success("INVOICING.INVOICE.PAID recorded in sandbox", {
        description: `${updated.number} · ${formatMoney(updated.amount, updated.currency)} from ${updated.clientName}`,
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update the invoice."),
    onSettled: () => setPendingId(null),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Everything you have drafted and sent, with each invoice's pre-flight result."
        actions={
          <Button asChild>
            <Link to="/app/new-invoice">
              <FilePlus2 aria-hidden="true" />
              New invoice
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 wide:grid-cols-4">
        <KpiCard
          label="Draft"
          tone="neutral"
          icon={CircleDashed}
          count={kpis.draft.length}
          amounts={totalsByCurrency(kpis.draft)}
          loading={isLoading}
        />
        <KpiCard
          label="Sent (unpaid)"
          tone="primary"
          icon={Send}
          count={kpis.sent.length}
          amounts={totalsByCurrency(kpis.sent)}
          loading={isLoading}
        />
        <KpiCard
          label="Paid"
          tone="pass"
          icon={CheckCircle2}
          count={kpis.paid.length}
          amounts={totalsByCurrency(kpis.paid)}
          loading={isLoading}
        />
        <KpiCard
          label="Overdue"
          tone="warning"
          icon={Clock}
          count={kpis.overdue.length}
          amounts={totalsByCurrency(kpis.overdue)}
          loading={isLoading}
        />
      </div>

      <section aria-labelledby="invoice-list" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="invoice-list" className="text-base font-semibold text-foreground">
            All invoices
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <label htmlFor="invoice-search" className="sr-only">
                Search invoices
              </label>
              <Input
                id="invoice-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search client or invoice #"
                className="pl-9 sm:w-64"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v === "all" ? "all" : InvoiceStatusSchema.parse(v))}
            >
              <SelectTrigger className="sm:w-44" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {InvoiceStatusSchema.options.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isError ? (
          <EmptyState
            tone="error"
            icon={AlertCircle}
            title="Could not load invoices"
            description="Check your connection and try again."
            action={
              <Button variant="outline" onClick={fetchLiveInvoices}>
                Try again
              </Button>
            }
          />
        ) : isLoading ? (
          <GridSkeleton />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={FileStack}
            title="No invoices yet"
            description="Invoices you send from PreFlight appear here."
            action={
              <Button asChild>
                <Link to="/app/new-invoice">Create your first invoice</Link>
              </Button>
            }
          />
        ) : (
          <ClientOnly fallback={<GridSkeleton />}>
            <Suspense fallback={<GridSkeleton />}>
              <InvoicesGrid
                rows={rows}
                quickFilter={search}
                context={{
                  pendingId,
                  onMarkPaid: (inv) => paidMutation.mutate(inv),
                }}
              />
            </Suspense>
          </ClientOnly>
        )}
      </section>
    </div>
  );
}
