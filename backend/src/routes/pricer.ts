import { Router, Request, Response } from "express";
import { calcPricing } from "../../../shared/pricer";
import type { PricingInput } from "../../../shared/types";

export const pricerRouter = Router();

// POST /api/pricer
pricerRouter.post("/", async (req: Request, res: Response) => {
  const input = req.body as PricingInput;

  if (typeof input?.targetNet !== "number" || !input?.currency) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "targetNet and currency are required.",
      },
    });
  }

  // Pure pricer execution using shared logic
  const result = calcPricing(input);
  return res.json(result);
});
