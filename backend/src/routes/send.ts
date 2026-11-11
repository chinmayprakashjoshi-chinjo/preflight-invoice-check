import { Router } from "express";
import { generateInvoice } from "../controllers/invoiceController.js";

export const sendRouter = Router();

// POST /api/send (Authoritative send endpoint per PRD Section 11.3)
sendRouter.post("/", generateInvoice);

export default sendRouter;
