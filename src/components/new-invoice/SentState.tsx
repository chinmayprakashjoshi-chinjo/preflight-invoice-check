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
    <div className="rounded-xl border border-pass/30 bg-pass-tint p-6 text-center" role="status">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface text-pass">
        <CheckCircle2 className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">
        Invoice sent in PayPal Sandbox
      </h3>
      <div className="mt-2 flex justify-center">
        <StatusChip status="sent" />
      </div>
      <dl className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-3 text-left">
        <div className="col-span-2 rounded-lg bg-surface p-3">
          <dt className="text-xs text-muted-foreground">PayPal invoice ID</dt>
          <dd className="tabular mt-0.5 break-all text-sm font-medium text-foreground">
            {invoice.paypalInvoiceId}
          </dd>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <dt className="text-xs text-muted-foreground">Amount</dt>
          <dd className="mt-0.5">
            <MoneyText
              amount={invoice.amount}
              currency={invoice.currency}
              tone="accent"
              size="md"
            />
          </dd>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <dt className="text-xs text-muted-foreground">Due</dt>
          <dd className="tabular mt-0.5 text-base text-foreground">
            {formatDate(invoice.dueDate)}
          </dd>
        </div>
        <div className="col-span-2 rounded-lg bg-surface p-3">
          <dt className="text-xs text-muted-foreground">Client</dt>
          <dd className="mt-0.5 text-sm text-foreground">{invoice.clientName}</dd>
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
