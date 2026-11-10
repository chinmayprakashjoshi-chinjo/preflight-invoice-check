import { Router, Request, Response } from "express";

export const webhooksRouter = Router();

// POST /api/webhooks/paypal (PayPal webhook endpoint with raw body verification)
webhooksRouter.post("/paypal", async (_req: Request, res: Response) => {
  res.json({ message: "PayPal webhook verification route skeleton" });
});
