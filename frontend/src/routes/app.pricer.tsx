import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { calcPricing, type PricingRates } from "@/lib/pricer";
import { CURRENCIES, CurrencySchema, type Currency } from "@/lib/types";

export const Route = createFileRoute("/app/pricer")({
  head: () => ({
    meta: [
      { title: "Net-Landing Pricer · PreFlight" },
      {
        name: "description",
        content: "Work out what to invoice so the amount you want lands after PayPal fees and FX.",
      },
      { property: "og:title", content: "Net-Landing Pricer · PreFlight" },
      {
        property: "og:description",
        content: "Work out what to invoice so the amount you want lands after PayPal fees and FX.",
      },
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
    <Select
      value={value}
      onValueChange={(v) => onChange(CurrencySchema.parse(v))}
      disabled={disabled ?? false}
    >
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

function Row({
  label,
  hint,
  children,
  strong,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt>
        <span
          className={strong ? "text-sm font-medium text-foreground" : "text-sm text-foreground"}
        >
          {label}
        </span>
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

  // Editable rates (placeholders). Stored as text so typing stays natural.
  const [feePct, setFeePct] = useState(String(+(PRICING_CONFIG.feeRate * 100).toFixed(4)));
  const [fixedFees, setFixedFees] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(PRICING_CONFIG.fixedFee).map(([k, v]) => [k, String(v)])),
  );
  const [fxPct, setFxPct] = useState(String(+(PRICING_CONFIG.fxSpread * 100).toFixed(4)));

  const rates = useMemo<PricingRates>(() => {
    const num = (t: string, fallback: number) =>
      t.trim() !== "" && Number.isFinite(Number(t)) && Number(t) >= 0 ? Number(t) : fallback;
    const computedFixed: Record<string, number> = {
      ...(PRICING_CONFIG.fixedFee as Record<string, number>),
    };
    for (const [k, v] of Object.entries(fixedFees)) {
      computedFixed[k] = num(v, (PRICING_CONFIG.fixedFee as Record<string, number>)[k] ?? 0.49);
    }
    return {
      feeRate: Math.min(num(feePct, PRICING_CONFIG.feeRate * 100) / 100, 0.95),
      fixedFee: computedFixed,
      fxSpread: Math.min(num(fxPct, PRICING_CONFIG.fxSpread * 100) / 100, 0.95),
      midRates: PRICING_CONFIG.midRates,
    };
  }, [feePct, fixedFees, fxPct]);

  const net = Number(netText);
  const invalid = netText.trim() !== "" && (!Number.isFinite(net) || net < 0);
  const crossActive = cross && clientCurrency !== currency;

  const result = useMemo(
    () =>
      calcPricing(
        {
          targetNet: invalid ? 0 : net || 0,
          currency,
          clientCurrency,
          crossCurrency: cross,
        },
        rates,
      ),
    [net, invalid, currency, clientCurrency, cross, rates],
  );

  const ready = result.invoiceAmount > 0;

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Net-Landing Pricer"
        subtitle="Enter what you want to receive. PreFlight works out what to invoice after PayPal fees and currency conversion."
      />

      <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 desk:px-8 desk:py-8 space-y-6 flex-1">
        <div className="grid items-start gap-6 wide:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section
            aria-labelledby="pricer-inputs"
            className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs"
          >
            <h2 id="pricer-inputs" className="text-base font-bold text-slate-900">
              What you want to receive
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
              <div>
                <label htmlFor="target-net" className="text-xs font-semibold text-slate-700">
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
                  className="tabular mt-1.5 h-11 text-lg font-bold text-slate-900"
                />
                <p
                  id="target-net-hint"
                  className={
                    invalid
                      ? "mt-1.5 text-xs text-rose-600 font-medium"
                      : "mt-1.5 text-xs text-slate-500"
                  }
                >
                  {invalid
                    ? "Enter a positive amount."
                    : "The amount that should land in your PayPal balance."}
                </p>
              </div>
              <div>
                <label htmlFor="own-currency" className="text-xs font-semibold text-slate-700">
                  Currency
                </label>
                <div className="mt-1.5 [&_button]:h-11">
                  <CurrencySelect id="own-currency" value={currency} onChange={setCurrency} />
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor="cross-toggle"
                  className="text-sm font-semibold text-slate-800 cursor-pointer"
                >
                  Client pays in a different currency
                </label>
                <Switch id="cross-toggle" checked={cross} onCheckedChange={setCross} />
              </div>
              <div className="mt-4">
                <label htmlFor="client-currency" className="text-xs font-medium text-slate-600">
                  Client currency
                </label>
                <div className="mt-1.5">
                  <CurrencySelect
                    id="client-currency"
                    value={clientCurrency}
                    onChange={setClientCurrency}
                    disabled={!cross}
                  />
                </div>
                {cross && clientCurrency === currency && (
                  <p className="mt-1.5 text-xs font-medium text-amber-700">
                    Same as your currency, so no conversion applies.
                  </p>
                )}
              </div>
            </div>

            <Collapsible className="mt-5 rounded-xl border border-slate-200/80 bg-white">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-800 [&[data-state=open]>svg]:rotate-180">
                Rates configuration
                <ChevronDown
                  className="size-4 text-slate-400 transition-transform"
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 border-t border-slate-100 px-4 py-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="rate-fee" className="text-xs font-medium text-slate-600">
                      Fee %
                    </label>
                    <Input
                      id="rate-fee"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={feePct}
                      onChange={(e) => setFeePct(e.target.value)}
                      className="tabular mt-1.5"
                    />
                  </div>
                  <div>
                    <label htmlFor="rate-fixed" className="text-xs font-medium text-slate-600">
                      Fixed fee ({currency})
                    </label>
                    <Input
                      id="rate-fixed"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={fixedFees[currency]}
                      onChange={(e) => setFixedFees((f) => ({ ...f, [currency]: e.target.value }))}
                      className="tabular mt-1.5"
                    />
                  </div>
                  <div>
                    <label htmlFor="rate-fx" className="text-xs font-medium text-slate-600">
                      FX spread %
                    </label>
                    <Input
                      id="rate-fx"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={fxPct}
                      onChange={(e) => setFxPct(e.target.value)}
                      className="tabular mt-1.5"
                    />
                  </div>
                </div>
                <p className="flex items-start gap-1.5 text-xs text-slate-500">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-indigo-600" aria-hidden="true" />
                  Placeholder rates, update from PayPal&rsquo;s current pricing.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </section>

          <section
            aria-labelledby="pricer-result"
            className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden"
            aria-live="polite"
          >
            <div className="border-b border-slate-100 bg-slate-50/60 p-6">
              <h2
                id="pricer-result"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Invoice amount to send
              </h2>
              <MoneyText
                amount={result.invoiceAmount}
                currency={result.invoiceCurrency}
                tone="accent"
                size="xl"
                className="mt-1 block"
              />
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
                hint={`${formatPercent(rates.feeRate)} + ${(rates.fixedFee[currency] ?? 0.49).toFixed(2)} ${currency} fixed`}
              >
                <MoneyText amount={-result.paypalFee} currency={currency} />
              </Row>
              <Row
                label="FX spread"
                hint={
                  crossActive
                    ? `${formatPercent(rates.fxSpread, 1)} on conversion`
                    : "No conversion"
                }
              >
                <MoneyText
                  amount={-result.fxSpreadCost}
                  currency={currency}
                  tone={crossActive ? "default" : "muted"}
                />
              </Row>
              <Row label="Effective cost" hint="(gross − net) ÷ gross">
                <span className="tabular text-sm font-medium text-foreground">
                  {formatPercent(result.effectiveCostRate)}
                </span>
              </Row>
              <Row label="You receive" strong>
                <MoneyText
                  amount={result.net}
                  currency={currency}
                  tone="accent"
                  size="md"
                  className="font-semibold"
                />
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
                    to: "/app/new-invoice",
                    search: {
                      amount: Math.round(result.invoiceAmount * 100) / 100,
                      currency: result.invoiceCurrency,
                      targetNet: Math.round(result.net * 100) / 100,
                      userCurrency: currency,
                    },
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
    </div>
  );
}
