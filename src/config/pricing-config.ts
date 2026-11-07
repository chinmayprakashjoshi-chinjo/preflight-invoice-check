import type { Currency } from "@/lib/types";

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
  } satisfies Record<Currency, number>,

  /** PLACEHOLDER: currency conversion spread applied when the client pays in another currency. */
  fxSpread: 0.03,

  /** PLACEHOLDER: mid-market rates, expressed as 1 unit of `from` in `to`. */
  midRates: {
    USD: { USD: 1, EUR: 0.92 },
    EUR: { USD: 1.087, EUR: 1 },
  } satisfies Record<Currency, Record<Currency, number>>,
} as const;

export type PricingConfig = typeof PRICING_CONFIG;
