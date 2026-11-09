import { PRICING_CONFIG } from "@/config/pricing-config";
import { formatMoney, formatPercent } from "./format";
import type { Currency, PricingInput, PricingResult } from "./types";

export interface PricingRates {
  feeRate: number;
  fixedFee: Record<Currency, number>;
  fxSpread: number;
  midRates: Record<Currency, Record<Currency, number>>;
}

function ceil2(n: number): number {
  // Small epsilon guards against float noise like 1243.3300000001 -> 1243.34
  return Math.ceil(n * 100 - 1e-6) / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Works out what to invoice so that `targetNet` lands in your account.
 *
 * Same currency:      gross = (net + fixedFee) / (1 - feeRate)
 * Different currency: gross = (net + fixedFee) / ((1 - feeRate) * (1 - fxSpread))
 *
 * effective cost = (gross - net) / gross
 *
 * Gross is rounded up to the cent so you never land below the target.
 */
export function calcPricing(
  input: PricingInput,
  config: PricingRates = PRICING_CONFIG,
): PricingResult {
  const { targetNet, currency, clientCurrency } = input;
  const cross = input.crossCurrency && clientCurrency !== currency;
  const net = Math.max(0, targetNet);

  const feeRate = config.feeRate;
  const fixedFee = config.fixedFee[currency];
  const spread = cross ? config.fxSpread : 0;

  if (net === 0) {
    return {
      invoiceAmount: 0,
      invoiceCurrency: cross ? clientCurrency : currency,
      grossInOwnCurrency: 0,
      paypalFee: 0,
      fxSpreadCost: 0,
      net: 0,
      effectiveCostRate: 0,
      explanation: "Enter the amount you want to receive to see what to invoice.",
    };
  }

  const gross = ceil2((net + fixedFee) / ((1 - feeRate) * (1 - spread)));
  const fxSpreadCost = round2(gross * spread);
  const paypalFee = round2(gross - fxSpreadCost - net);
  const effectiveCostRate = (gross - net) / gross;

  const rate = cross ? config.midRates[currency][clientCurrency] : 1;
  const invoiceAmount = cross ? ceil2(gross * rate) : gross;
  const invoiceCurrency = cross ? clientCurrency : currency;

  const explanation = cross
    ? `Invoice ${formatMoney(invoiceAmount, invoiceCurrency)} so that, after the conversion spread and PayPal fee, ${formatMoney(net, currency)} lands in your account (${formatPercent(effectiveCostRate)} total cost).`
    : `Invoice ${formatMoney(invoiceAmount, invoiceCurrency)} so that, after the PayPal fee, ${formatMoney(net, currency)} lands in your account (${formatPercent(effectiveCostRate)} total cost).`;

  return {
    invoiceAmount,
    invoiceCurrency,
    grossInOwnCurrency: gross,
    paypalFee,
    fxSpreadCost,
    net,
    effectiveCostRate,
    explanation,
  };
}
