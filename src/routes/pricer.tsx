import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyText } from "@/components/preflight/MoneyText";
import { PageHeader } from "@/components/preflight/PageHeader";
import { PRICING_CONFIG } from "@/config/pricing-config";
import { formatPercent } from "@/lib/format";
import { calcPricing } from "@/lib/pricer";
import { CURRENCIES, CurrencySchema, type Currency } from "@/lib/types";

export const Route = createFileRoute("/pricer")({
  head: () => ({
    meta: [
      { title: "Net-Landing Pricer · PreFlight" },
      { name: "description", content: "Work out what to invoice so the amount you want lands after PayPal fees and FX." },
      { property: "og:title", content: "Net-Landing Pricer · PreFlight" },
      { property: "og:description", content: "Work out what to invoice so the amount you want lands after PayPal fees and FX." },
    ],
  }),
  component: PricerPage,
});

function CurrencySelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: Currency;
  onChange: (c: Currency) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(CurrencySchema.parse(v))} disabled={disabled ?? false}>
      <SelectTrigger id={id}>
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
  );
}

function Row({ label, hint, children, strong }: { label: string; hint?: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt>
        <span className={strong ? "text-sm font-medium text-foreground" : "text-sm text-foreground"}>{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function PricerPage() {
  const navigate = useNavigate();
  const [netText, setNetText] = useState("1200");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [clientCurrency, setClientCurrency] = useState<Currency>("EUR");
  const [cross, setCross] = useState(false);

  const net = Number(netText);
  const invalid = netText.trim() !== "" && (!Number.isFinite(net) || net < 0);
  const crossActive = cross && clientCurrency !== currency;

  const result = useMemo(
    () =>
      calcPricing({
        targetNet: invalid ? 0 : net || 0,
        currency,
        clientCurrency,
        crossCurrency: cross,
      }),
    [net, invalid, currency, clientCurrency, cross],
  );

  const ready = result.invoiceAmount > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Net-Landing Pricer"
        subtitle="Enter what you want to receive. PreFlight works out what to invoice after PayPal fees and currency conversion."
      />

      <div className="grid items-start gap-6 wide:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section aria-labelledby="pricer-inputs" className="rounded-xl border bg-surface p-5">
          <h2 id="pricer-inputs" className="text-base font-semibold text-foreground">
            What you want to receive
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
            <div>
              <label htmlFor="target-net" className="text-xs font-medium text-foreground">
                Target net amount
              </label>
              <Input
                id="target-net"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={netText}
                onChange={(e) => setNetText(e.target.value)}
                aria-invalid={invalid}
                aria-describedby="target-net-hint"
                className="tabular mt-1.5 h-11 text-lg"
              />
              <p id="target-net-hint" className={invalid ? "mt-1 text-xs text-blocker-strong" : "mt-1 text-xs text-muted-foreground"}>
                {invalid ? "Enter a positive amount." : "The amount that should land in your PayPal balance."}
              </p>
            </div>
            <div>
              <label htmlFor="own-currency" className="text-xs font-medium text-foreground">
                Currency
              </label>
              <div className="mt-1.5 [&_button]:h-11">
                <CurrencySelect id="own-currency" value={currency} onChange={setCurrency} />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="cross-toggle" className="text-sm font-medium text-foreground">
                Client pays in a different currency
              </label>
              <Switch id="cross-toggle" checked={cross} onCheckedChange={setCross} />
            </div>
            <div className="mt-4">
              <label htmlFor="client-currency" className="text-xs font-medium text-foreground">
                Client currency
              </label>
              <div className="mt-1.5">
                <CurrencySelect id="client-currency" value={clientCurrency} onChange={setClientCurrency} disabled={!cross} />
              </div>
              {cross && clientCurrency === currency && (
                <p className="mt-1 text-xs text-warning-strong">Same as your currency, so no conversion applies.</p>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="pricer-result" className="rounded-xl border bg-surface" aria-live="polite">
          <div className="border-b p-5">
            <h2 id="pricer-result" className="text-sm font-medium text-muted-foreground">
              Invoice amount to send
            </h2>
            <MoneyText amount={result.invoiceAmount} currency={result.invoiceCurrency} tone="accent" size="xl" className="mt-1 block" />
            <p className="mt-2 text-sm text-muted-foreground">{result.explanation}</p>
          </div>
          <dl className="divide-y px-5">
            {crossActive && (
              <Row label="Gross in your currency" hint="Before any deductions">
                <MoneyText amount={result.grossInOwnCurrency} currency={currency} />
              </Row>
            )}
            <Row
              label="PayPal fee"
              hint={`${formatPercent(PRICING_CONFIG.feeRate)} + ${PRICING_CONFIG.fixedFee[currency].toFixed(2)} ${currency} fixed`}
            >
              <MoneyText amount={-result.paypalFee} currency={currency} />
            </Row>
            <Row label="FX spread" hint={crossActive ? `${formatPercent(PRICING_CONFIG.fxSpread, 1)} on conversion` : "No conversion"}>
              <MoneyText amount={-result.fxSpreadCost} currency={currency} tone={crossActive ? "default" : "muted"} />
            </Row>
            <Row label="Effective cost" hint="(gross − net) ÷ gross">
              <span className="tabular text-sm font-medium text-foreground">{formatPercent(result.effectiveCostRate)}</span>
            </Row>
            <Row label="You receive" strong>
              <MoneyText amount={result.net} currency={currency} tone="accent" size="md" className="font-semibold" />
            </Row>
          </dl>
          <div className="space-y-3 rounded-b-xl border-t bg-muted/60 p-5">
            <Button
              type="button"
              className="w-full"
              size="lg"
              disabled={!ready}
              onClick={() =>
                navigate({
                  to: "/new-invoice",
                  search: { amount: result.invoiceAmount, currency: result.invoiceCurrency },
                })
              }
            >
              Use this amount in a new invoice
              <ArrowRight aria-hidden="true" />
            </Button>
            {PRICING_CONFIG.isPlaceholder && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3.5 text-info" aria-hidden="true" />
                Rates are placeholders; configure in pricing-config
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
