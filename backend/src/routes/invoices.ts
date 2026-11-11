import { Router } from "express";
import {
  generateInvoice,
  listInvoices,
  getInvoiceById,
  markInvoicePaid,
} from "../controllers/invoiceController.js";

export const invoicesRouter = Router();

// POST /api/invoices/generate: PreFlight AI Co-pilot validation + PayPal Sandbox generation
invoicesRouter.post("/generate", generateInvoice);

// GET /api/invoices: List all invoices
invoicesRouter.get("/", listInvoices);

// GET /api/invoices/:id: Retrieve single invoice details
invoicesRouter.get("/:id", getInvoiceById);

// POST /api/invoices/:id/mark-paid: Mark an invoice as paid (sandbox demo)
invoicesRouter.post("/:id/mark-paid", markInvoicePaid);

export default invoicesRouter;
