import type { Currency, DraftInvoice, PaymentTerms } from "./types.js";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: Currency): string {
  const key = currency;
  let f = moneyFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    moneyFormatters.set(key, f);
  }
  return f.format(amount);
}

export function formatPercent(rate: number, digits = 2): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Formats a yyyy-mm-dd string as "8 Nov 2026" without timezone drift. */
export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFormatter.format(d);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function termsToDays(terms: PaymentTerms): number {
  return Number(terms.replace("Net ", ""));
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dueDateFor(invoice: Pick<DraftInvoice, "invoiceDate" | "paymentTerms">): string {
  return addDaysIso(invoice.invoiceDate, termsToDays(invoice.paymentTerms));
}

export function invoiceTotal(invoice: Pick<DraftInvoice, "lineItems">): number {
  return round2(
    invoice.lineItems.reduce((sum: number, li: { quantity: number; unitPrice: number }) => sum + li.quantity * li.unitPrice, 0),
  );
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
