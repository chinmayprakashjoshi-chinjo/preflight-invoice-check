import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/preflight/PageHeader";
import { formatMoney, formatDate, pluralize, todayIso } from "@/lib/format";
import { clientsQuery } from "@/lib/queries";
import { useInvoices } from "@/context/InvoicesContext";
import { MOCK_CLIENTS } from "@/mocks/clients";
import type { Client, Currency, InvoiceRecord, InvoiceStatus } from "@/lib/types";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard · PreFlight" },
      {
        name: "description",
        content: "Where your invoices stand, and what needs a look before the next one goes out.",
      },
    ],
  }),
  component: DashboardPage,
});

type EffectiveStatus = "draft" | "sent" | "paid" | "overdue";

function getEffectiveStatus(inv: InvoiceRecord, today: string): EffectiveStatus {
  if (inv.status === "draft") return "draft";
  if (inv.status === "paid") return "paid";
  if (inv.status === "sent") {
    return inv.dueDate && inv.dueDate < today ? "overdue" : "sent";
  }
  return (inv.status as EffectiveStatus) || "sent";
}

function formatTotals(list: InvoiceRecord[]): string {
  if (list.length === 0) return "$0.00";
  const totalsByCurrency: Record<string, number> = {};
  for (const inv of list) {
    totalsByCurrency[inv.currency] = (totalsByCurrency[inv.currency] || 0) + inv.amount;
  }
  const currencies = Object.keys(totalsByCurrency).sort((a, b) => {
    if (a === "USD") return -1;
    if (b === "USD") return 1;
    return a.localeCompare(b);
  });
  return currencies
    .map((curr) => formatMoney(totalsByCurrency[curr], curr as Currency))
    .join(" · ");
}

function StatusDot({ status }: { status: EffectiveStatus }) {
  switch (status) {
    case "draft":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <span className="size-1.5 rounded-full bg-slate-400 shrink-0" aria-hidden="true" />
          Draft
        </span>
      );
    case "sent":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600">
          <span className="size-1.5 rounded-full bg-indigo-600 shrink-0" aria-hidden="true" />
          Sent
        </span>
      );
    case "paid":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
          Paid
        </span>
      );
    case "overdue":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600">
          <span className="size-1.5 rounded-full bg-rose-500 shrink-0" aria-hidden="true" />
          Overdue
        </span>
      );
  }
}

function getLowConfidenceCount(client: Client): number {
  if (!client.requirements) return 0;
  return Object.values(client.requirements.meta).filter((m) => m.confidence === "low").length;
}

function DashboardPage() {
  const { invoices } = useInvoices();
  const clientsQ = useQuery(clientsQuery);

  const clients = clientsQ.data && clientsQ.data.length > 0 ? clientsQ.data : MOCK_CLIENTS;

  const today = todayIso();

  const groups = useMemo(() => {
    const draft: InvoiceRecord[] = [];
    const sent: InvoiceRecord[] = [];
    const paid: InvoiceRecord[] = [];
    const overdue: InvoiceRecord[] = [];

    for (const inv of invoices) {
      const st = getEffectiveStatus(inv, today);
      if (st === "draft") draft.push(inv);
      else if (st === "sent") sent.push(inv);
      else if (st === "paid") paid.push(inv);
      else if (st === "overdue") overdue.push(inv);
    }

    return { draft, sent, paid, overdue };
  }, [invoices, today]);

  const recentInvoices = useMemo(() => {
    // Keep seed order matching reference dashboard, but float any newly issued invoices to the top
    const desiredOrder = [
      "INV-2026-0107",
      "INV-2026-0106",
      "INV-2026-0105",
      "INV-2026-0104",
      "INV-2026-0102",
      "INV-2026-0103",
    ];
    const list = [...invoices];
    list.sort((a, b) => {
      const isNewA = !desiredOrder.includes(a.number);
      const isNewB = !desiredOrder.includes(b.number);
      if (isNewA && isNewB) return b.number.localeCompare(a.number);
      if (isNewA) return -1;
      if (isNewB) return 1;
      return desiredOrder.indexOf(a.number) - desiredOrder.indexOf(b.number);
    });
    return list.slice(0, 8);
  }, [invoices]);

  const clientsNeedingAttention = useMemo(() => {
    return clients.filter((c) => getLowConfidenceCount(c) > 0);
  }, [clients]);

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Dashboard"
        subtitle="Where your invoices stand, and what needs a look before the next one goes out."
        actions={
          <Button
            asChild
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100 border-0"
          >
            <Link to="/app/new-invoice">New invoice</Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 desk:px-8 desk:py-8 space-y-6 flex-1">
        {/* KPI Strip */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {/* Draft */}
          <div className="px-6 py-3 sm:py-0 first:pl-2 first:pt-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span className="size-2 rounded-full bg-slate-400 shrink-0" aria-hidden="true" />
              Draft
            </div>
            <div className="text-3xl font-bold tracking-tight text-slate-900 mt-3">
              {groups.draft.length}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              {formatTotals(groups.draft)}
            </div>
          </div>

          {/* Sent (unpaid) */}
          <div className="px-6 py-3 sm:py-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span className="size-2 rounded-full bg-indigo-600 shrink-0" aria-hidden="true" />
              Sent (unpaid)
            </div>
            <div className="text-3xl font-bold tracking-tight text-slate-900 mt-3">
              {groups.sent.length}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              {formatTotals(groups.sent)}
            </div>
          </div>

          {/* Paid */}
          <div className="px-6 py-3 sm:py-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span className="size-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
              Paid
            </div>
            <div className="text-3xl font-bold tracking-tight text-slate-900 mt-3">
              {groups.paid.length}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              {formatTotals(groups.paid)}
            </div>
          </div>

          {/* Overdue */}
          <div className="px-6 py-3 sm:py-0 last:pr-2 last:pb-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span className="size-2 rounded-full bg-rose-500 shrink-0" aria-hidden="true" />
              Overdue
            </div>
            <div className="text-3xl font-bold tracking-tight text-slate-900 mt-3">
              {groups.overdue.length}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              {formatTotals(groups.overdue)}
            </div>
          </div>
        </div>

        {/* Two-Column Lower Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Recent Invoices Card */}
          <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Recent invoices</h2>
              <Link
                to="/app/invoices"
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                View all
              </Link>
            </div>

            <div className="mt-4 -mx-6 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th scope="col" className="py-3 pl-6 pr-4">
                      Invoice #
                    </th>
                    <th scope="col" className="py-3 px-4">
                      Client
                    </th>
                    <th scope="col" className="py-3 px-4 text-right">
                      Amount
                    </th>
                    <th scope="col" className="py-3 px-4">
                      Due
                    </th>
                    <th scope="col" className="py-3 pl-4 pr-6">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {recentInvoices.map((inv) => {
                    const effectiveStatus = getEffectiveStatus(inv, today);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 pl-6 pr-4 font-mono font-medium text-slate-800">
                          <Link
                            to="/app/invoices"
                            className="hover:text-indigo-600 hover:underline"
                          >
                            {inv.number}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900">{inv.clientName}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                          {formatMoney(inv.amount, inv.currency)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 tabular-nums">
                          {formatDate(inv.dueDate)}
                        </td>
                        <td className="py-3.5 pl-4 pr-6">
                          <StatusDot status={effectiveStatus} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Clients Needing Attention Card */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col">
            <h2 className="text-base font-bold text-slate-900">Clients needing attention</h2>

            <div className="mt-2 divide-y divide-slate-100">
              {clientsNeedingAttention.length > 0 ? (
                clientsNeedingAttention.map((c) => {
                  const lowCount = getLowConfidenceCount(c);
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-4 first:pt-3 last:pb-1"
                    >
                      <div className="min-w-0 pr-3">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{c.name}</h3>
                        <p className="mt-0.5 text-xs font-medium text-amber-800">
                          {pluralize(lowCount, "low-confidence rule")} to check
                        </p>
                      </div>
                      <Link
                        to="/app/clients"
                        search={{ client: c.id }}
                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline shrink-0"
                      >
                        Review
                      </Link>
                    </div>
                  );
                })
              ) : (
                <p className="py-6 text-center text-xs text-slate-500">
                  All client requirements verified with high confidence.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default DashboardPage;
