import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyText } from "@/components/preflight/MoneyText";
import { dueDateFor, invoiceTotal } from "@/lib/format";
import {
  CURRENCIES,
  PAYMENT_TERMS,
  type Client,
  type DraftInvoice,
  type FixField,
  type LineItem,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { newLineItem } from "./draft-utils";

interface DraftInvoiceFormProps {
  draft: DraftInvoice;
  clients: Client[];
  clientsLoading: boolean;
  onChange: (next: DraftInvoice) => void;
  onClientChange: (clientId: string) => void;
  /** Field that a pre-flight fix just changed, highlighted briefly. */
  flashField: FixField | null;
  flashLineId?: string | undefined;
}

function Field({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DraftInvoiceForm({
  draft,
  clients,
  clientsLoading,
  onChange,
  onClientChange,
  flashField,
  flashLineId,
}: DraftInvoiceFormProps) {
  const set = <K extends keyof DraftInvoice>(key: K, value: DraftInvoice[K]) =>
    onChange({ ...draft, [key]: value });

  const flash = (field: FixField) => (flashField === field ? "field-flash" : "");

  const updateLine = (id: string, patch: Partial<LineItem>) =>
    set(
      "lineItems",
      draft.lineItems.map((li) => (li.id === id ? { ...li, ...patch } : li)),
    );

  const removeLine = (id: string) =>
    set(
      "lineItems",
      draft.lineItems.filter((li) => li.id !== id),
    );

  const total = invoiceTotal(draft);
  const dueDate = dueDateFor(draft);

  return (
    <section
      aria-labelledby="draft-title"
      className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-4">
        <div>
          <h2 id="draft-title" className="text-base font-bold text-slate-900">
            Draft invoice
          </h2>
          <p className="text-xs text-slate-500">
            Every field is editable. Checks update as you type.
          </p>
        </div>
      </div>

      <div className="space-y-6 p-5">
        {/* Client */}
        <fieldset className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="sr-only">Client</legend>
          <Field id="client-account" label="Client account" hint="Whose AP rules apply.">
            <Select
              value={draft.clientId ?? ""}
              onValueChange={onClientChange}
              disabled={clientsLoading}
            >
              <SelectTrigger id="client-account" aria-label="Client account">
                <SelectValue placeholder={clientsLoading ? "Loading clients" : "Choose a client"} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="client-name" label="Bill to (name on invoice)">
            <Input
              id="client-name"
              value={draft.clientName}
              onChange={(e) => set("clientName", e.target.value)}
              placeholder="Client's legal name"
              className={flash("clientName")}
              autoComplete="organization"
            />
          </Field>
          <Field id="send-to" label="Send to" className="sm:col-span-2">
            <Input
              id="send-to"
              type="email"
              value={draft.sendTo}
              onChange={(e) => set("sendTo", e.target.value)}
              placeholder="ap@client.example"
              className={flash("sendTo")}
              autoComplete="email"
            />
          </Field>
        </fieldset>

        {/* Terms and references */}
        <fieldset className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
          <legend className="sr-only">Terms and references</legend>
          <Field id="currency" label="Currency">
            <Select
              value={draft.currency}
              onValueChange={(v) => set("currency", v as DraftInvoice["currency"])}
            >
              <SelectTrigger id="currency" className={flash("currency")} aria-label="Currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="terms" label="Payment terms">
            <Select
              value={draft.paymentTerms}
              onValueChange={(v) => set("paymentTerms", v as DraftInvoice["paymentTerms"])}
            >
              <SelectTrigger
                id="terms"
                className={flash("paymentTerms")}
                aria-label="Payment terms"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="po" label="PO reference">
            <Input
              id="po"
              value={draft.poNumber}
              onChange={(e) => set("poNumber", e.target.value)}
              placeholder="PO-2026-00000"
              className={cn("tabular", flash("poNumber"))}
            />
          </Field>
          <Field id="vat" label="VAT ID">
            <Input
              id="vat"
              value={draft.vatId}
              onChange={(e) => set("vatId", e.target.value)}
              placeholder="Optional"
              className={cn("tabular", flash("vatId"))}
            />
          </Field>
          <Field id="invoice-date" label="Invoice date">
            <Input
              id="invoice-date"
              type="date"
              value={draft.invoiceDate}
              onChange={(e) => set("invoiceDate", e.target.value)}
              className="tabular"
            />
          </Field>
          <Field id="due-date" label="Due date" hint={`Auto from ${draft.paymentTerms}`}>
            <Input id="due-date" type="date" value={dueDate} readOnly className="tabular" />
          </Field>
        </fieldset>

        {/* Line items */}
        <fieldset className="min-w-0">
          <legend className="text-xs font-medium text-foreground">Line items</legend>
          <div className="mt-2 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Description
                  </th>
                  <th scope="col" className="w-20 px-3 py-2 font-medium">
                    Qty
                  </th>
                  <th scope="col" className="w-32 px-3 py-2 font-medium">
                    Unit price
                  </th>
                  <th scope="col" className="w-32 px-3 py-2 text-right font-medium">
                    Amount
                  </th>
                  <th scope="col" className="w-10 px-2 py-2">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {draft.lineItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No line items yet. Add one to set the invoice total.
                    </td>
                  </tr>
                )}
                {draft.lineItems.map((li, idx) => (
                  <tr key={li.id} className="border-t align-top">
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Line ${idx + 1} description`}
                        value={li.description}
                        onChange={(e) => updateLine(li.id, { description: e.target.value })}
                        placeholder="What did you deliver?"
                        className={cn(
                          flashField === "lineItemDescription" &&
                            flashLineId === li.id &&
                            "field-flash",
                        )}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Line ${idx + 1} quantity`}
                        type="number"
                        min={0}
                        step="1"
                        inputMode="decimal"
                        value={li.quantity}
                        onChange={(e) =>
                          updateLine(li.id, { quantity: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="tabular"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Line ${idx + 1} unit price`}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={li.unitPrice}
                        onChange={(e) =>
                          updateLine(li.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="tabular"
                      />
                    </td>
                    <td className="px-3 py-2 text-right leading-9">
                      <MoneyText amount={li.quantity * li.unitPrice} currency={draft.currency} />
                    </td>
                    <td className="px-1 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(li.id)}
                        aria-label={`Remove line ${idx + 1}`}
                        className="text-muted-foreground hover:text-blocker-strong"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/60">
                  <td colSpan={3} className="px-3 py-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => set("lineItems", [...draft.lineItems, newLineItem()])}
                    >
                      <Plus aria-hidden="true" />
                      Add item
                    </Button>
                  </td>
                  <td className="px-3 py-3 text-right" colSpan={2}>
                    <span className="block text-xs text-muted-foreground">Total</span>
                    <MoneyText amount={total} currency={draft.currency} tone="accent" size="lg" />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </fieldset>
      </div>
    </section>
  );
}
