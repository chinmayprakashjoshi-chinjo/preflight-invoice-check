import type { Client, Currency, ParsedDraft } from "./types";

export const EXAMPLE_PROMPT = "Invoice Acme Corp $1,200 for site redesign";

const FALLBACK: Omit<ParsedDraft, "clientId"> = {
  clientName: "Acme Corp",
  amount: 1200,
  currency: "USD",
  description: "site redesign",
};

/**
 * Very small one-line parser: "Invoice <client> <amount> for <description>".
 * Falls back to the Acme example for anything it cannot read.
 * If existingAmount is provided, preserves that amount and only extracts client and description.
 */
export function parseDraftPrompt(
  text: string,
  clients: Client[],
  existingAmount?: number,
  existingCurrency?: Currency,
): ParsedDraft {
  const cleanText = text
    .replace(/\(Note: KEEP the existing total amount.*?\)/is, "")
    .replace(/\[Instruction:.*?\]/is, "")
    .trim();

  const input = cleanText.replace(/^invoice\s+/i, "");

  const amountMatch = input.match(
    /(?:(\$|€|£|¥|₹|usd|eur|gbp|jpy|aud|cad|inr|cny|chf|sgd)\s?)?(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.(\d{1,2}))?(?:\s?(\$|€|£|¥|₹|usd|eur|gbp|jpy|aud|cad|inr|cny|chf|sgd))?/i,
  );

  let clientName = FALLBACK.clientName;
  let amount = existingAmount && existingAmount > 0 ? existingAmount : FALLBACK.amount;
  let currency: Currency = existingCurrency || FALLBACK.currency;
  let description = FALLBACK.description;

  if (amountMatch && amountMatch.index !== undefined) {
    if (!existingAmount || existingAmount <= 0) {
      const whole = (amountMatch[2] ?? "").replace(/[,\s]/g, "");
      const cents = amountMatch[3] ?? "0";
      const parsed = Number(`${whole}.${cents}`);
      if (parsed > 0) amount = parsed;
    }

    if (!existingCurrency) {
      const symbol = (amountMatch[1] ?? amountMatch[4] ?? "").toLowerCase();
      if (symbol === "€" || symbol === "eur") currency = "EUR";
      else if (symbol === "£" || symbol === "gbp") currency = "GBP";
      else if (symbol === "¥" || symbol === "jpy") currency = "JPY";
      else if (symbol === "₹" || symbol === "inr") currency = "INR";
      else if (symbol === "aud") currency = "AUD";
      else if (symbol === "cad") currency = "CAD";
      else if (symbol === "cny") currency = "CNY";
      else if (symbol === "chf") currency = "CHF";
      else if (symbol === "sgd") currency = "SGD";
    }

    const before = input.slice(0, amountMatch.index).trim();
    if (before) clientName = before;

    const after = input.slice(amountMatch.index + amountMatch[0].length).trim();
    const desc = after.replace(/^(for|-|:)\s*/i, "").trim();
    if (desc) description = desc;
  } else {
    const desc = input.replace(/^(for|-|:)\s*/i, "").trim();
    if (desc) description = desc;
  }

  if (existingAmount && existingAmount > 0) {
    amount = existingAmount;
  }
  if (existingCurrency) {
    currency = existingCurrency;
  }

  return { clientName, amount, currency, description, clientId: matchClient(clientName, clients) };
}

/** Matches a free-text name to a client account by its first significant word. */
export function matchClient(name: string, clients: Client[]): string | null {
  const first = name.trim().toLowerCase().split(/\s+/)[0];
  if (!first) return null;
  const hit = clients.find((c) => c.name.toLowerCase().split(/\s+/)[0] === first);
  return hit?.id ?? null;
}
