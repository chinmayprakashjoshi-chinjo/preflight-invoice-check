import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Check, Copy, ExternalLink, FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/preflight/MoneyText";
import { StatusChip } from "@/components/preflight/StatusChip";
import { formatDate } from "@/lib/format";
import type { InvoiceRecord } from "@/lib/types";

export function SentState({
  invoice,
  onStartNew,
}: {
  invoice: InvoiceRecord;
  onStartNew: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!invoice.payerLink) return;
    try {
      await navigator.clipboard.writeText(invoice.payerLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy the link. Select it and copy it by hand.");
    }
  }

  return (
    <div
      className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-6 text-center"
      role="status"
    >
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-emerald-200/80 bg-white text-emerald-600 shadow-2xs">
        <CheckCircle2 className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-bold text-slate-900">Invoice sent in PayPal Sandbox</h3>
      <div className="mt-2.5 flex justify-center">
        <StatusChip status="sent" />
      </div>
      <dl className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-3 text-left">
        <div className="col-span-2 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <dt className="text-xs font-medium text-slate-500">PayPal invoice ID</dt>
          <dd className="tabular mt-0.5 break-all text-xs font-mono font-semibold text-slate-900">
            {invoice.paypalInvoiceId}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <dt className="text-xs font-medium text-slate-500">Amount</dt>
          <dd className="mt-0.5">
            <MoneyText
              amount={invoice.amount}
              currency={invoice.currency}
              tone="accent"
              size="md"
            />
          </dd>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <dt className="text-xs font-medium text-slate-500">Due</dt>
          <dd className="tabular mt-0.5 text-sm font-semibold text-slate-900">
            {formatDate(invoice.dueDate)}
          </dd>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <dt className="text-xs font-medium text-slate-500">Client</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">{invoice.clientName}</dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" onClick={copyLink}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy payer link"}
        </Button>
        {invoice.payerLink && (
          <Button asChild variant="outline">
            <a href={invoice.payerLink} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              Open payer link
            </a>
          </Button>
        )}
        <Button asChild>
          <Link to="/app/invoices">View in Invoices</Link>
        </Button>
        <Button type="button" variant="ghost" onClick={onStartNew}>
          <FilePlus2 aria-hidden="true" />
          Start a new invoice
        </Button>
      </div>
    </div>
  );
}
