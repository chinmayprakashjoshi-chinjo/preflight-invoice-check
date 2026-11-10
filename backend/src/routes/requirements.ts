import { Router, Request, Response } from "express";
import { db } from "../../lib/db";

export const requirementsRouter = Router();

// POST /api/requirements (Extract from doc/text)
requirementsRouter.post("/", async (_req: Request, res: Response) => {
  res.json({ message: "Requirements extraction route skeleton" });
});

// PATCH /api/requirements/:id
requirementsRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { value, evidence, confidence } = req.body;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = db.from("requirements").update({
      value,
      source: "user",
      updated_at: new Date().toISOString(),
      ...(evidence ? { evidence } : {}),
      ...(confidence ? { confidence } : {}),
    });

    if (isUuid) {
      query = query.eq("id", id);
    } else {
      query = query.eq("key", id);
    }

    const { data, error } = await query.select();
    if (error) throw error;

    return res.json({ success: true, updated: data });
  } catch (err: any) {
    console.error("[requirementsRouter] PATCH error:", err);
    return res.status(500).json({ error: { code: "INTERNAL", message: err.message } });
  }
});

// POST /api/requirements/learn
requirementsRouter.post("/learn", async (_req: Request, res: Response) => {
  res.json({ message: "Requirements learn from email route skeleton" });
});

export default requirementsRouter;
