import { describe, expect, it } from "vitest";
import { parseDraftPrompt } from "./parse-draft";
import { MOCK_CLIENTS } from "@/mocks/clients";

describe("parseDraftPrompt", () => {
  it("parses prompt with client, amount, currency, and description", () => {
    const result = parseDraftPrompt("Invoice Acme Corp $1,200 for site redesign", MOCK_CLIENTS);
    expect(result.clientName).toBe("Acme Corp");
    expect(result.amount).toBe(1200);
    expect(result.currency).toBe("USD");
    expect(result.description).toBe("site redesign");
    expect(result.clientId).toBe("acme");
  });

  it("preserves existing amount when existingAmount is passed (e.g. from Pricer)", () => {
    const result = parseDraftPrompt(
      "Invoice Acme Corp $1,200 for site redesign",
      MOCK_CLIENTS,
      1424.88,
      "USD",
    );
    expect(result.clientName).toBe("Acme Corp");
    expect(result.amount).toBe(1424.88);
    expect(result.currency).toBe("USD");
    expect(result.description).toBe("site redesign");
    expect(result.clientId).toBe("acme");
  });

  it("cleans system/note instruction strings and preserves existing amount", () => {
    const instructed =
      "Invoice Northwind Studio €950 for brand refresh (Note: KEEP the existing total amount of 2500 EUR. ONLY generate the description, client name, and other missing details, ignoring any amount mentioned in the user's text prompt.)";
    const result = parseDraftPrompt(instructed, MOCK_CLIENTS, 2500, "EUR");
    expect(result.clientName).toBe("Northwind Studio");
    expect(result.amount).toBe(2500);
    expect(result.currency).toBe("EUR");
    expect(result.description).toBe("brand refresh");
    expect(result.clientId).toBe("northwind");
  });
});
