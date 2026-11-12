import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MoneyText } from "@/components/preflight/MoneyText";
import { PreflightResultPill } from "@/components/preflight/PreflightResultPill";
import { dueDateFor, formatDate, invoiceTotal } from "@/lib/format";
import type { DraftInvoice } from "@/lib/types";
import { MOCK_PROFILE } from "@/mocks/profile";

interface InvoicePreviewDialogProps {
  draft: DraftInvoice;
  summary: { blockers: number; warnings: number } | null;
}

export function InvoicePreviewDialog({ draft, summary }: InvoicePreviewDialogProps) {
  const total = invoiceTotal(draft);
  const lines = draft.lineItems.filter(
    (li) => (typeof li.description === "string" ? li.description.trim() : String(li.description ?? "").trim()) || li.unitPrice > 0,
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="rounded-xl border-white/20 bg-white/10 text-white shadow-2xs hover:bg-white/20 hover:text-white"
        >
          <Eye aria-hidden="true" />
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-8">
            <DialogTitle>Invoice preview</DialogTitle>
            {summary && <PreflightResultPill {...summary} />}
          </div>
          <DialogDescription>
            This is what the client&rsquo;s AP team will receive.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row">
            <div>
              <p className="text-xl font-semibold tracking-tight text-foreground">Invoice</p>
              <p className="tabular mt-1 text-sm text-muted-foreground">
                Draft, number assigned on send
              </p>
            </div>
            <div className="text-sm sm:text-right">
              <p className="font-medium text-foreground">{MOCK_PROFILE.name}</p>
              {MOCK_PROFILE.address.map((l) => (
                <p key={l} className="text-muted-foreground">
                  {l}
                </p>
              ))}
              <p className="text-muted-foreground">{MOCK_PROFILE.email}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Bill to
              </p>
              <p className="mt-1 font-medium text-foreground">
                {draft.clientName || "No client name"}
              </p>
              <p className="text-muted-foreground">{draft.sendTo || "No recipient email"}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <dt className="text-muted-foreground">Invoice date</dt>
              <dd className="tabular text-right text-foreground">
                {formatDate(draft.invoiceDate)}
              </dd>
              <dt className="text-muted-foreground">Due date</dt>
              <dd className="tabular text-right text-foreground">
                {formatDate(dueDateFor(draft))}
              </dd>
              <dt className="text-muted-foreground">Terms</dt>
              <dd className="text-right text-foreground">{draft.paymentTerms}</dd>
              <dt className="text-muted-foreground">PO</dt>
              <dd className="tabular text-right text-foreground">{draft.poNumber || "None"}</dd>
              {draft.vatId && (
                <>
                  <dt className="text-muted-foreground">VAT ID</dt>
                  <dd className="tabular text-right text-foreground">{draft.vatId}</dd>
                </>
              )}
            </dl>
          </div>

          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="pb-2 font-medium">
                  Description
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Qty
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Unit price
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">
                    No line items
                  </td>
                </tr>
              ) : (
                lines.map((li) => (
                  <tr key={li.id} className="border-b">
                    <td className="py-3 pr-4 text-foreground">
                      {typeof li.description === "string" ? li.description : String(li.description ?? "") || "Untitled item"}
                    </td>
                    <td className="tabular py-3 text-right text-foreground">{li.quantity}</td>
                    <td className="py-3 text-right">
                      <MoneyText amount={li.unitPrice} currency={draft.currency} />
                    </td>
                    <td className="py-3 text-right">
                      <MoneyText amount={li.quantity * li.unitPrice} currency={draft.currency} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-4 text-right font-medium text-foreground">
                  Total due ({draft.currency})
                </td>
                <td className="pt-4 text-right">
                  <MoneyText amount={total} currency={draft.currency} tone="accent" size="lg" />
                </td>
              </tr>
            </tfoot>
          </table>

          <p className="mt-8 text-xs text-muted-foreground">
            Pay via PayPal to {MOCK_PROFILE.paypalEmail}. Please quote the invoice number with your
            payment.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
