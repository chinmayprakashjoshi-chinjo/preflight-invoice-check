import { Router, Request, Response } from "express";
import { db } from "../../lib/db.js";
import {
  extractRequirements,
  handleLearnFromEmail,
} from "../controllers/clientController.js";

export const requirementsRouter = Router();

// POST /api/requirements (Extract from doc/text using Gemini LLM)
requirementsRouter.post("/", extractRequirements);

// POST /api/requirements/learn (Learn rule from client rejection email)
requirementsRouter.post("/learn", handleLearnFromEmail);

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

export default requirementsRouter;
