import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";
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
      className="font-inter font-normal rounded-none border border-white/10 bg-[#0B0F19] p-6 text-center text-slate-200"
      role="status"
    >
      {/* Neo-brutalist status indicator */}
      <div className="mx-auto flex size-10 items-center justify-center rounded-none border border-[#ccff00]/30 bg-[#ccff00]/10 text-[#ccff00]">
        <Check className="size-5" aria-hidden="true" />
      </div>

      <h3 className="font-inter mt-3.5 text-base sm:text-lg font-bold text-white tracking-tight">
        Invoice sent in PayPal Sandbox
      </h3>

      <div className="mt-2.5 flex justify-center">
        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-none bg-[#ccff00]/10 text-[#ccff00] font-mono tracking-wider">
          Sent
        </span>
      </div>

      {/* Clean receipt summary without input boxes */}
      <div className="mx-auto mt-6 max-w-md rounded-none border border-white/10 bg-white/[0.02] text-left">
        <div className="divide-y divide-white/10">
          {/* PayPal Invoice ID */}
          <div className="p-3.5">
            <span className="block font-inter text-[11px] font-medium uppercase tracking-wider text-slate-400">
              PayPal invoice ID
            </span>
            <span className="mt-1 block font-mono text-xs font-semibold text-white break-all">
              {invoice.paypalInvoiceId || invoice.number}
            </span>
          </div>

          {/* Amount & Due Date Grid */}
          <div className="grid grid-cols-2 divide-x divide-white/10">
            <div className="p-3.5">
              <span className="block font-inter text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Amount
              </span>
              <span className="mt-1 block font-inter text-base font-bold text-[#ccff00] tabular-nums">
                {formatMoney(invoice.amount, invoice.currency)}
              </span>
            </div>
            <div className="p-3.5">
              <span className="block font-inter text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Due Date
              </span>
              <span className="mt-1 block font-inter text-sm font-semibold text-white tabular-nums">
                {formatDate(invoice.dueDate)}
              </span>
            </div>
          </div>

          {/* Client */}
          <div className="p-3.5">
            <span className="block font-inter text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Client
            </span>
            <span className="mt-1 block font-inter text-sm font-semibold text-white">
              {invoice.clientName}
            </span>
          </div>
        </div>
      </div>

      {/* Neo-Brutalist Buttons */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {invoice.payerLink && (
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center justify-center gap-1.5 rounded-none border border-white/20 bg-transparent px-3.5 py-2 font-inter text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? <Check className="size-3.5 text-[#ccff00]" /> : <Copy className="size-3.5" />}
            <span>{copied ? "Copied" : "Copy payer link"}</span>
          </button>
        )}

        {invoice.payerLink && (
          <a
            href={invoice.payerLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-none border border-white/20 bg-transparent px-3.5 py-2 font-inter text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            <ExternalLink className="size-3.5" />
            <span>Open payer link</span>
          </a>
        )}

        <Link
          to="/app/invoices"
          className="inline-flex items-center justify-center rounded-none bg-[#8967D2] px-4 py-2 font-inter text-xs font-bold text-white hover:brightness-110 transition-all cursor-pointer"
        >
          View in Invoices
        </Link>

        <button
          type="button"
          onClick={onStartNew}
          className="inline-flex items-center justify-center gap-1.5 rounded-none border border-white/20 bg-transparent px-3.5 py-2 font-inter text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
        >
          <FilePlus2 className="size-3.5" />
          <span>Start a new invoice</span>
        </button>
      </div>
    </div>
  );
}
