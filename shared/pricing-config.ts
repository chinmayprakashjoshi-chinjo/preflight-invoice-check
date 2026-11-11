import type { Currency } from "./types.js";

/** Mid-market conversion rates relative to 1 USD. */
export const USD_MID_RATES: Record<Currency, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 155.0,
  AUD: 1.54,
  CAD: 1.38,
  INR: 84.0,
  CNY: 7.25,
  CHF: 0.90,
  SGD: 1.35,
  NZD: 1.68,
  HKD: 7.80,
  SEK: 10.80,
  NOK: 11.00,
  MXN: 19.50,
  BRL: 5.60,
  ZAR: 18.20,
};

/**
 * Computes mid-rate from one currency to another using USD as standard bridge.
 */
export function getMidRate(from: Currency, to: Currency): number {
  if (from === to) return 1;
  const fromUsd = USD_MID_RATES[from] ?? 1;
  const toUsd = USD_MID_RATES[to] ?? 1;
  return toUsd / fromUsd;
}

/**
 * PLACEHOLDER RATES. These are not PayPal's real fees.
 * Replace them with the rates from your PayPal account (or load them from the backend)
 * before relying on the Net-Landing Pricer.
 */
export const PRICING_CONFIG = {
  /** True while the numbers below are placeholders. The UI shows a note while this is set. */
  isPlaceholder: true,

  /** PLACEHOLDER: percentage fee taken from each received payment (0.0349 = 3.49%). */
  feeRate: 0.0349,

  /** PLACEHOLDER: fixed fee per payment, in the currency you receive. */
  fixedFee: {
    USD: 0.49,
    EUR: 0.39,
    GBP: 0.30,
    JPY: 40.0,
    AUD: 0.59,
    CAD: 0.59,
    INR: 30.0,
    CNY: 3.0,
    CHF: 0.55,
    SGD: 0.65,
    NZD: 0.69,
    HKD: 3.90,
    SEK: 4.50,
    NOK: 4.50,
    MXN: 10.0,
    BRL: 2.50,
    ZAR: 8.0,
  } satisfies Record<Currency, number>,

  /** PLACEHOLDER: currency conversion spread applied when the client pays in another currency. */
  fxSpread: 0.03,

  /** PLACEHOLDER: mid-market rates, expressed as 1 unit of `from` in `to`. */
  midRates: {
    USD: { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 155, AUD: 1.54, CAD: 1.38, INR: 84, CNY: 7.25, CHF: 0.9, SGD: 1.35, NZD: 1.68, HKD: 7.8, SEK: 10.8, NOK: 11, MXN: 19.5, BRL: 5.6, ZAR: 18.2 },
    EUR: { USD: 1.087, EUR: 1, GBP: 0.86, JPY: 168, AUD: 1.67, CAD: 1.5, INR: 91.3, CNY: 7.88, CHF: 0.98, SGD: 1.47, NZD: 1.83, HKD: 8.48, SEK: 11.7, NOK: 11.9, MXN: 21.2, BRL: 6.09, ZAR: 19.8 },
  } as Record<string, Record<string, number>>,
} as const;

export type PricingConfig = typeof PRICING_CONFIG;
