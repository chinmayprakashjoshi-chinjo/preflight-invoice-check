import { Router, Request, Response } from "express";
import { preflight } from "../../../shared/preflight.js";
import { resolveClient, buildClientResponse } from "../controllers/clientController.js";
import { validateInvoiceWithAICoPilot } from "../services/aiService.js";
import type { DraftInvoice, ClientRequirements } from "../../../shared/types.js";

export const preflightRouter = Router();

// POST /api/preflight
preflightRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { invoice, requirements, clientId } = req.body as {
      invoice?: DraftInvoice;
      requirements?: ClientRequirements;
      clientId?: string;
      format?: string;
    };

    if (!invoice) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invoice data is required.",
        },
      });
    }

    let activeRequirements: ClientRequirements | null = requirements || null;

    if (!activeRequirements && (clientId || invoice.clientId || invoice.clientName)) {
      const targetId = clientId || invoice.clientId || invoice.clientName;
      const client = await resolveClient(targetId || "");
      if (client) {
        const fullClient = await buildClientResponse(client);
        activeRequirements = fullClient.requirements;
      }
    }

    if (!activeRequirements) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Could not find AP requirements for this client.",
        },
      });
    }

    // Run AI Co-pilot qualitative check (soft warning only per CLAUDE.md rule 4)
    const assessment = await validateInvoiceWithAICoPilot(invoice, activeRequirements);
    const issues = preflight(invoice, activeRequirements);

    if (req.query.format === "details" || req.body?.format === "details" || req.headers["x-details"] === "true") {
      return res.json({
        issues,
        counts: {
          blockers: assessment.blockers.length,
          warnings: assessment.warnings.length,
          passed: assessment.passed.length,
        },
        canSend: assessment.approved,
        aiReview: assessment.aiReview,
      });
    }

    return res.json(issues);
  } catch (err: any) {
    console.error("[preflightRouter] error:", err);
    return res.status(500).json({
      error: { code: "INTERNAL", message: err.message || "Preflight check failed" },
    });
  }
});
