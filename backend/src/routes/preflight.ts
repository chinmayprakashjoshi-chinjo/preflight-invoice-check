import { Router, Request, Response } from "express";
import { preflight } from "../../../shared/preflight";
import type { DraftInvoice, ClientRequirements } from "../../../shared/types";

export const preflightRouter = Router();

// POST /api/preflight
preflightRouter.post("/", async (req: Request, res: Response) => {
  const { invoice, requirements } = req.body as {
    invoice?: DraftInvoice;
    requirements?: ClientRequirements;
  };

  if (!invoice || !requirements) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Both invoice and requirements are required.",
      },
    });
  }

  // Pure preflight execution using shared logic
  const issues = preflight(invoice, requirements);
  const blockers = issues.filter((i) => i.severity === "blocker").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const passed = issues.filter((i) => i.severity === "pass").length;

  return res.json({
    issues,
    counts: { blockers, warnings, passed },
    canSend: blockers === 0,
  });
});
