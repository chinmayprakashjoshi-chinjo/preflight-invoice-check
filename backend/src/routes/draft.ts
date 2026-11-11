import { Router, Request, Response } from "express";
import { resolveClient } from "../controllers/clientController.js";
import { parseDraftWithAI } from "../services/aiService.js";
import type { Currency, ParsedDraft } from "../../../shared/types.js";

export const draftRouter = Router();

// POST /api/draft (Parse one-line prompt into draft invoice)
draftRouter.post("/", async (req: Request, res: Response) => {
  try {
    const rawText = String(req.body?.text || "").trim();
    if (!rawText) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Text prompt is required" } });
    }

    // Extract existing amount and currency if provided
    let existingAmount: number | undefined;
    if (typeof req.body?.existingAmount === "number" && req.body.existingAmount > 0) {
      existingAmount = req.body.existingAmount;
    } else if (Number(req.body?.existingAmount) > 0) {
      existingAmount = Number(req.body.existingAmount);
    }

    // Also check if instruction annotation inside prompt text specifies existing amount
    if (!existingAmount) {
      const match = rawText.match(/KEEP the existing total amount of\s+([0-9.]+)/i);
      if (match && Number(match[1]) > 0) {
        existingAmount = Number(match[1]);
      }
    }

    const existingCurrency = (req.body?.existingCurrency as Currency) || undefined;

    // Clean user prompt text from instruction notes for AI and regex parsing
    const cleanUserText = rawText
      .replace(/\(Note: KEEP the existing total amount.*?\)/is, "")
      .replace(/\[Instruction:.*?\]/is, "")
      .trim();

    // 1. Try AI parsing first if available
    let draftResult: { clientName: string; description: string; amount: number; currency: Currency } | null = null;
    try {
      draftResult = await parseDraftWithAI(cleanUserText, existingAmount, existingCurrency);
    } catch {
      draftResult = null;
    }

    let clientName = draftResult?.clientName || "Acme Corp";
    let amount = existingAmount && existingAmount > 0 ? existingAmount : (draftResult?.amount ?? 1200);
    let currency: Currency = (existingAmount && existingCurrency) ? existingCurrency : (draftResult?.currency ?? "USD");
    let description = draftResult?.description || "Professional services";

    // 2. If AI did not return a result, use deterministic regex parser
    if (!draftResult) {
      const input = cleanUserText.replace(/^invoice\s+/i, "");
      const amountMatch = input.match(
        /(?:(\$|€|usd|eur)\s?)?(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.(\d{1,2}))?(?:\s?(\$|€|usd|eur))?/i,
      );

      if (amountMatch && amountMatch.index !== undefined) {
        if (!existingAmount || existingAmount <= 0) {
          const whole = (amountMatch[2] ?? "").replace(/[,\s]/g, "");
          const cents = amountMatch[3] ?? "0";
          const parsed = Number(`${whole}.${cents}`);
          if (parsed > 0) amount = parsed;
        }

        const symbol = (amountMatch[1] ?? amountMatch[4] ?? "").toLowerCase();
        if (!existingCurrency && (symbol === "€" || symbol === "eur")) {
          currency = "EUR";
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
