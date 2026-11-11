import { Router } from "express";
import {
  listClients,
  getClientById,
  updateClientRequirements,
  updateSingleRule,
} from "../controllers/clientController.js";

export const clientsRouter = Router();

// GET /api/clients - Live clients list with AP requirements from Supabase
clientsRouter.get("/", listClients);

// GET /api/clients/:id - Single client with requirements
clientsRouter.get("/:id", getClientById);

// PUT & PATCH /api/clients/:id/requirements - Update all/any requirements for client in Supabase
clientsRouter.put("/:id/requirements", updateClientRequirements);
clientsRouter.patch("/:id/requirements", updateClientRequirements);

// PATCH /api/clients/:clientId/rules/:ruleId - Update specific rule in Supabase
clientsRouter.patch("/:clientId/rules/:ruleId", updateSingleRule);
clientsRouter.patch("/:clientId/requirements/:ruleId", updateSingleRule);

export default clientsRouter;
