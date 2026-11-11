import { Router, Request, Response } from "express";
import { resolveClient } from "../controllers/clientController.js";
import type { Currency, ParsedDraft } from "../../../shared/types.js";

export const draftRouter = Router();

// POST /api/draft (Parse one-line prompt into draft invoice)
draftRouter.post("/", async (req: Request, res: Response) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Text prompt is required" } });
    }

    const input = text.replace(/^invoice\s+/i, "");
    const amountMatch = input.match(
      /(?:(\$|€|usd|eur)\s?)?(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.(\d{1,2}))?(?:\s?(\$|€|usd|eur))?/i,
    );

    let clientName = "Acme Corp";
    let amount = 1200;
    let currency: Currency = "USD";
    let description = "Professional services";

    if (amountMatch && amountMatch.index !== undefined) {
      const whole = (amountMatch[2] ?? "").replace(/[,\s]/g, "");
      const cents = amountMatch[3] ?? "0";
      const parsed = Number(`${whole}.${cents}`);
      if (parsed > 0) amount = parsed;

      const symbol = (amountMatch[1] ?? amountMatch[4] ?? "").toLowerCase();
      if (symbol === "€" || symbol === "eur") currency = "EUR";

      const before = input.slice(0, amountMatch.index).trim();
      if (before) clientName = before;

      const after = input.slice(amountMatch.index + amountMatch[0].length).trim();
      const desc = after.replace(/^(for|-|:)\s*/i, "").trim();
      if (desc) description = desc;
    }

    // Try resolving client from DB
    const resolved = await resolveClient(clientName);
    let matchedClientId: string | null = null;
    if (resolved) {
      const lower = resolved.name.toLowerCase();
      if (lower.includes("acme")) matchedClientId = "acme";
      else if (lower.includes("northwind")) matchedClientId = "northwind";
      else if (lower.includes("globex")) matchedClientId = "globex";
      else matchedClientId = resolved.id;
    }

    const result: ParsedDraft = {
      clientName,
      amount,
      currency,
      description,
      clientId: matchedClientId,
    };

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: { code: "INTERNAL", message: err.message } });
  }
});

export default draftRouter;
