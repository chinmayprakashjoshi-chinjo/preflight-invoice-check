import { Router } from "express";
import { resetDevData } from "../controllers/devController.js";

export const devRouter = Router();

// POST /api/dev/reset (API-14: Reseeds Supabase from seed fixtures on demand when DEMO_MODE=true)
devRouter.post("/reset", resetDevData);

export default devRouter;
