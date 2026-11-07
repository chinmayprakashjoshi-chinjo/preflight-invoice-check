import { Link } from "@tanstack/react-router";
import { CheckCircle2, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/preflight/MoneyText";
import { formatDate } from "@/lib/format";
import type { InvoiceRecord } from "@/lib/types";

export function SentState({
  invoice,
  onStartNew,
}: {
  invoice: InvoiceRecord;
  onStartNew: () => void;
}) {
  return (
    <div className="rounded-xl border border-pass/30 bg-pass-tint p-6 text-center" role="status">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface text-pass">
        <CheckCircle2 className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">Invoice sent in PayPal Sandbox</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {invoice.number} to {invoice.clientName}
      </p>
      <dl className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-3 text-left">
        <div className="rounded-lg bg-surface p-3">
          <dt className="text-xs text-muted-foreground">Amount</dt>
          <dd className="mt-0.5">
            <MoneyText amount={invoice.amount} currency={invoice.currency} tone="accent" size="md" />
          </dd>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <dt className="text-xs text-muted-foreground">Due</dt>
          <dd className="tabular mt-0.5 text-base text-foreground">{formatDate(invoice.dueDate)}</dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline">
          <Link to="/invoices">View in Invoices</Link>
        </Button>
        <Button type="button" onClick={onStartNew}>
          <FilePlus2 aria-hidden="true" />
          Start a new invoice
        </Button>
      </div>
    </div>
  );
}
