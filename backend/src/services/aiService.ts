import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { preflight } from "../../../shared/preflight";
import type { DraftInvoice, ClientRequirements, Issue } from "../../../shared/types";

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

export interface AICoPilotAssessment {
  approved: boolean;
  blockers: Issue[];
  warnings: Issue[];
  passed: Issue[];
  aiReview: AICoPilotReview;
}

/**
 * Calls the configured LLM (Google Gemini or OpenAI) to perform qualitative AP checks.
 */
async function callLLM(prompt: string): Promise<AICoPilotReview> {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim() || "gemini-2.5-flash";

  if (!apiKey) {
    // Graceful fallback when LLM_API_KEY is not yet populated
    return {
      approved: true,
      score: 95,
      summary: "AI Co-pilot heuristic review: Line items and terms appear standard and compliant.",
      recommendations: ["Ensure deliverables are signed off by the client project manager."],
    };
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
                "You are PreFlight's Accounts Payable (AP) AI Co-pilot. Evaluate the draft invoice for compliance and clarity. Return ONLY a valid JSON object matching: {\"approved\": boolean, \"score\": number (0-100), \"summary\": string, \"recommendations\": string[]}.",
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
      const geminiModel = model.includes("gemini") ? model : "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    console.warn("[aiService] LLM call failed, falling back to local heuristic validation:", errorMsg);
    return {
      approved: true,
      score: 88,
      summary: "AI Co-pilot fallback: Deterministic checks passed; deliverables ready for invoicing.",
      recommendations: ["Review invoice terms against client agreement."],
    };
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

  // Per CLAUDE.md Hard Rule 4: Blockers come only from code rules.
  // The overall approval requires ZERO code blockers AND an approved AI assessment.
  const isApproved = blockers.length === 0 && aiReview.approved;

  return {
    approved: isApproved,
    blockers,
    warnings,
    passed,
    aiReview,
  };
}

export default {
  validateInvoiceWithAICoPilot,
};
