import { describe, expect, it } from "vitest";
import { calcPricing } from "./pricer";

const config = {
  feeRate: 0.05,
  fixedFee: { USD: 1, EUR: 1 },
  fxSpread: 0.04,
  midRates: { USD: { USD: 1, EUR: 0.9 }, EUR: { USD: 1.1, EUR: 1 } },
};

describe("calcPricing", () => {
  it("same currency: gross = (net + fixedFee) / (1 - feeRate)", () => {
    const r = calcPricing({ targetNet: 94, currency: "USD", clientCurrency: "USD", crossCurrency: false }, config);
    // (94 + 1) / 0.95 = 100
    expect(r.invoiceAmount).toBe(100);
    expect(r.paypalFee).toBe(6);
    expect(r.fxSpreadCost).toBe(0);
  });

  it("effective cost = (gross - net) / gross", () => {
    const r = calcPricing({ targetNet: 94, currency: "USD", clientCurrency: "USD", crossCurrency: false }, config);
    expect(r.effectiveCostRate).toBeCloseTo(0.06, 6);
  });

  it("shows the FX spread as its own line when the client pays in another currency", () => {
    const r = calcPricing({ targetNet: 94, currency: "USD", clientCurrency: "EUR", crossCurrency: true }, config);
    // gross = 95 / (0.95 * 0.96) = 104.166.. -> rounded up to 104.17
    expect(r.grossInOwnCurrency).toBe(104.17);
    expect(r.fxSpreadCost).toBe(4.17);
    expect(r.paypalFee).toBe(6);
    expect(r.invoiceCurrency).toBe("EUR");
    expect(r.invoiceAmount).toBe(93.76); // 104.17 * 0.9 rounded up
  });

  it("never lands below the target net", () => {
    const r = calcPricing({ targetNet: 1200, currency: "USD", clientCurrency: "USD", crossCurrency: false }, config);
    const landed = r.grossInOwnCurrency * (1 - config.feeRate) - config.fixedFee.USD;
    expect(landed).toBeGreaterThanOrEqual(1200);
  });

  it("returns zeros for a zero target", () => {
    const r = calcPricing({ targetNet: 0, currency: "EUR", clientCurrency: "EUR", crossCurrency: false }, config);
    expect(r.invoiceAmount).toBe(0);
    expect(r.effectiveCostRate).toBe(0);
  });
});
