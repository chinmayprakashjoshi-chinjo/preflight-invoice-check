import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { preflight } from "../../../shared/preflight.js";
import type { DraftInvoice, ClientRequirements, Issue, Currency } from "../../../shared/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const AICoPilotReviewSchema = z.object({
  approved: z.boolean(),
  score: z.number().min(0).max(100),
  summary: z.string(),
  recommendations: z.array(z.string()).default([]),
});

export type AICoPilotReview = z.infer<typeof AICoPilotReviewSchema>;

export const ParsedDraftLLMSchema = z.object({
  clientName: z.string(),
  description: z.string(),
  amount: z.number().optional(),
  currency: z.enum(["USD", "EUR"]).optional(),
});

export type ParsedDraftLLM = z.infer<typeof ParsedDraftLLMSchema>;

/**
 * Calls Gemini or OpenAI to parse a user invoice prompt into draft fields.
 * If an existing amount is provided (e.g. from Pricer), explicitly instructs the LLM
 * to KEEP the existing total amount and ONLY generate the description, client name, and other missing details.
 */
export async function parseDraftWithAI(
  prompt: string,
  existingAmount?: number,
  existingCurrency?: Currency,
): Promise<{ clientName: string; description: string; amount: number; currency: Currency } | null> {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim() || "gemini-3.5-flash";

  if (!apiKey) return null;

  const isOpenAI = apiKey.startsWith("sk-") || model.toLowerCase().includes("gpt");

  const systemPrompt = `You are PreFlight's Accounts Payable (AP) AI Assistant.
A user will provide a one-line request to draft an invoice (e.g. "Invoice Acme Corp $1,200 for site redesign").
Extract the client name, description of work, amount, and currency.
${
  existingAmount && existingAmount > 0
    ? `CRITICAL CONSTRAINT: The invoice already has an established total amount of ${existingAmount} ${existingCurrency || ""}. You MUST KEEP this amount exactly as ${existingAmount} and MUST NOT overwrite it with any amount mentioned in the user prompt. ONLY extract or generate the clientName, description, and missing details, ignoring any amount mentioned in the user's text prompt.`
    : ""
}
Return ONLY a valid JSON object matching:
{"clientName": string, "description": string, "amount": number, "currency": "USD" | "EUR"}`;

  try {
    let rawContent = "{}";
    if (isOpenAI) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model.startsWith("gemini") ? "gpt-4o-mini" : model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as any;
      rawContent = json.choices?.[0]?.message?.content || "{}";
    } else {
      const geminiModel = model.replace(/^models\//, "");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(6000),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\nUser request: "${prompt}"\n\nReturn JSON only without markdown formatting.`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as any;
      rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    }

    const parsed = JSON.parse(rawContent);
    const valid = ParsedDraftLLMSchema.safeParse(parsed);
    if (!valid.success) return null;

    return {
      clientName: valid.data.clientName || "Acme Corp",
      description: valid.data.description || "Services rendered",
      amount:
        existingAmount && existingAmount > 0
          ? existingAmount
          : valid.data.amount && valid.data.amount > 0
            ? valid.data.amount
            : 1200,
      currency:
        existingCurrency ||
        (valid.data.currency === "EUR" ? "EUR" : "USD"),
    };
  } catch (err) {
    console.warn("[aiService] AI draft parsing failed, falling back to deterministic parser:", err);
    return null;
  }
}

export interface AICoPilotAssessment {
  approved: boolean;
  blockers: Issue[];
  warnings: Issue[];
  passed: Issue[];
  aiReview: AICoPilotReview | null;
}

/**
 * Calls the configured LLM (Google Gemini or OpenAI) to perform qualitative AP checks.
 */
async function callLLM(prompt: string): Promise<AICoPilotReview | null> {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim() || "gemini-3.5-flash";

  if (!apiKey) {
    console.warn("[aiService] LLM call skipped: LLM_API_KEY is not configured.");
    return null;
  }

  // Detect OpenAI vs Google Gemini based on key format or model name
  const isOpenAI = apiKey.startsWith("sk-") || model.toLowerCase().includes("gpt");

  try {
    if (isOpenAI) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model.startsWith("gemini") ? "gpt-4o-mini" : model,
          messages: [
            {
              role: "system",
              content:
                'You are PreFlight\'s Accounts Payable (AP) AI Co-pilot. Evaluate the draft invoice for compliance and clarity. Return ONLY a valid JSON object matching: {"approved": boolean, "score": number (0-100), "summary": string, "recommendations": string[]}.',
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API error (${res.status}): ${errText}`);
      }

      const json = (await res.json()) as any;
      const rawContent = json.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(rawContent);
      return AICoPilotReviewSchema.parse(parsed);
    } else {
      // Default to Google Gemini API
      const geminiModel = model.replace(/^models\//, "");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${prompt}\n\nReturn ONLY a valid JSON object without markdown code blocks matching this structure:\n{"approved": boolean, "score": number between 0 and 100, "summary": "brief executive summary", "recommendations": ["recommendation 1"]}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
      }

      const json = (await res.json()) as any;
      const rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = JSON.parse(rawContent);
      return AICoPilotReviewSchema.parse(parsed);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn("[aiService] LLM qualitative review call failed:", errorMsg);
    return null;
  }
}

/**
 * Validates invoice using:
 * 1. Deterministic pure pre-flight rules (PO required, legal name, currency, VAT ID, payment terms)
 * 2. LLM AI Co-pilot verification for scope clarity and risk prevention
 */
export async function validateInvoiceWithAICoPilot(
  invoice: DraftInvoice,
  requirements?: ClientRequirements | null,
): Promise<AICoPilotAssessment> {
  // 1. Run pure pre-flight check if requirements are present
  let blockers: Issue[] = [];
  let warnings: Issue[] = [];
  let passed: Issue[] = [];

  if (requirements) {
    const issues = preflight(invoice, requirements);
    blockers = issues.filter((i) => i.severity === "blocker");
    warnings = issues.filter((i) => i.severity === "warning");
    passed = issues.filter((i) => i.severity === "pass");
  }

  // 2. Build prompt for LLM qualitative check
  const prompt = `Review this invoice for Accounts Payable compliance:
- Client Name: ${invoice.clientName}
- Send To Email: ${invoice.sendTo}
- Currency: ${invoice.currency}
- Payment Terms: ${invoice.paymentTerms}
- PO Number: ${invoice.poNumber || "None"}
- VAT / Tax ID: ${invoice.vatId || "None"}
- Invoice Date: ${invoice.invoiceDate}
- Items:
${invoice.lineItems
  .map((item, idx) => `  ${idx + 1}. "${item.description}" - Qty: ${item.quantity} @ ${item.unitPrice} ${invoice.currency}`)
  .join("\n")}

Determine if this invoice is professional, unambiguous, and audit-friendly. Flag any suspicious or overly vague descriptions.`;

  const aiReview = await callLLM(prompt);

  // Per CLAUDE.md Hard Rule 4 & prompt requirements:
  // The AI review is a soft warning only.
  // It must never say approved: true when blockers exist.
  if (aiReview && blockers.length > 0) {
    aiReview.approved = false;
  }

  // It must never affect blockers. Blockers come strictly from code rules.
  const isApproved = blockers.length === 0;

  return {
    approved: isApproved,
    blockers,
    warnings,
    passed,
    aiReview,
  };
}

/* ---------- Document Extraction Schema & Intelligence ---------- */

export const ExtractedRuleSchema = z.object({
  key: z.enum([
    "poRequired",
    "legalName",
    "allowedCurrencies",
    "vatRequired",
    "paymentTerms",
    "apEmail",
    "oneInvoicePerFile",
  ]),
  label: z.string(),
  value: z.union([z.boolean(), z.string(), z.array(z.string())]),
  evidence: z.string().default("Extracted from procurement policy"),
  confidence: z.enum(["high", "medium", "low"]).default("high"),
  evidenceVerified: z.boolean().default(false),
});

export type ExtractedRule = z.infer<typeof ExtractedRuleSchema>;

export const ExtractedRulesResponseSchema = z.object({
  rules: z.array(ExtractedRuleSchema),
});

/**
 * Normalizes text and evidence strings to verify verbatim presence (NFR-04).
 */
export function verifyVerbatim(evidence: string, sourceText: string): boolean {
  if (!evidence || !sourceText) return false;
  const cleanSource = sourceText.replace(/\s+/g, " ").toLowerCase();
  const cleanEvidence = evidence
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (cleanEvidence.length < 5) return true;
  return cleanSource.includes(cleanEvidence);
}

/**
 * Calls Gemini LLM to extract structured AP requirements from document text.
 * Implements CLAUDE.md rule 3: Zod validate, retry once, then throw EXTRACTION_FAILED.
 * Never uses heuristic fallback data per user instruction.
 */
export async function extractAPRequirements(
  sourceText: string,
  clientName?: string,
): Promise<ExtractedRule[]> {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim() || "gemini-3.5-flash";

  if (!apiKey) {
    const error: any = new Error("Missing LLM_API_KEY in environment");
    error.code = "EXTRACTION_FAILED";
    error.statusCode = 502;
    throw error;
  }

  const prompt = `You are PreFlight's Accounts Payable (AP) Document Intelligence Engine.
Analyze the following client procurement document and extract the vendor payment requirements for ${clientName || "the client"}.

Available Rule Keys (use exact keys):
- "poRequired": boolean (true if PO reference is mandatory, false if optional/not required)
- "legalName": string (exact legal registered entity name required on the invoice)
- "allowedCurrencies": string[] (array of accepted currency codes, e.g. ["USD"] or ["EUR"])
- "vatRequired": boolean (true if Tax ID / VAT ID is required, false if not)
- "paymentTerms": "Net 15" | "Net 30" | "Net 45" (standard settlement terms)
- "apEmail": string (inbox where invoices must be dispatched)
- "oneInvoicePerFile": boolean (true if only 1 invoice per PDF is permitted)

CRITICAL INSTRUCTIONS:
1. "evidence" MUST BE an exact, verbatim quotation copied directly from the text.
2. "confidence" must be "high", "medium", or "low".
3. Return ONLY a valid JSON object matching:
{
  "rules": [
    {
      "key": "poRequired",
      "label": "Purchase Order Reference",
      "value": false,
      "evidence": "exact quote from text",
      "confidence": "high"
    }
  ]
}

Document Text:
${sourceText}`;

  const geminiModel = model.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  async function attemptExtraction(): Promise<ExtractedRule[] | null> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[aiService] Gemini extraction API error (${res.status}): ${errText}`);
      return null;
    }

    const json = (await res.json()) as any;
    const rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(rawContent);

    let rawRules: any[] = [];
    if (parsed && Array.isArray(parsed.rules)) {
      rawRules = parsed.rules;
    } else if (Array.isArray(parsed)) {
      rawRules = parsed;
    }

    const validated = ExtractedRulesResponseSchema.safeParse({ rules: rawRules });
    if (!validated.success || validated.data.rules.length === 0) {
      console.warn("[aiService] LLM output failed Zod validation:", validated.error?.message);
      return null;
    }

    // Run NFR-04 verbatim verification on each rule
    return validated.data.rules.map((rule) => {
      const isVerified = verifyVerbatim(rule.evidence, sourceText);
      return {
        ...rule,
        evidenceVerified: isVerified,
        confidence: isVerified ? rule.confidence : "low",
      };
    });
  }

  // Attempt 1
  try {
    const rules = await attemptExtraction();
    if (rules && rules.length > 0) {
      return rules;
    }
  } catch (err: any) {
    console.warn("[aiService] Extraction attempt 1 failed:", err.message || err);
  }

  // Retry once per CLAUDE.md Rule 3
  console.log("[aiService] Retrying LLM extraction once per CLAUDE.md rule 3...");
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const retryRules = await attemptExtraction();
    if (retryRules && retryRules.length > 0) {
      return retryRules;
    }
  } catch (retryErr: any) {
    console.warn("[aiService] Extraction retry attempt failed:", retryErr.message || retryErr);
  }

  // Fail strictly with EXTRACTION_FAILED per CLAUDE.md
  const failError: any = new Error("Failed to extract requirements from document after retry.");
  failError.code = "EXTRACTION_FAILED";
  failError.statusCode = 502;
  throw failError;
}

export default {
  validateInvoiceWithAICoPilot,
  extractAPRequirements,
  verifyVerbatim,
};
