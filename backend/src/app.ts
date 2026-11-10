import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

import { clientsRouter } from "./routes/clients";
import { requirementsRouter } from "./routes/requirements";
import { draftRouter } from "./routes/draft";
import { preflightRouter } from "./routes/preflight";
import { pricerRouter } from "./routes/pricer";
import { sendRouter } from "./routes/send";
import { invoicesRouter } from "./routes/invoices";
import { webhooksRouter } from "./routes/webhooks";

dotenv.config();

export const app: Express = express();

// Standard middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
    demoMode: process.env.DEMO_MODE === "true",
  });
});

// Mount modular API routes
app.use("/api/clients", clientsRouter);
app.use("/api/requirements", requirementsRouter);
app.use("/api/draft", draftRouter);
app.use("/api/preflight", preflightRouter);
app.use("/api/pricer", pricerRouter);
app.use("/api/send", sendRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/webhooks", webhooksRouter);

// Central error handler matching PRD error format
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[backend error]", err);
  res.status(500).json({
    error: {
      code: "INTERNAL",
      message: err.message || "An unexpected error occurred",
      details: {},
    },
  });
});

export default app;
