import { Router, Request, Response } from "express";

export const draftRouter = Router();

// POST /api/draft (Parse one-line prompt into draft invoice)
draftRouter.post("/", async (_req: Request, res: Response) => {
  res.json({ message: "Draft parsing route skeleton" });
});
