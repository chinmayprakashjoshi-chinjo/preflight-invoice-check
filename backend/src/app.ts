import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

import { clientsRouter } from "./routes/clients.js";
import { requirementsRouter } from "./routes/requirements.js";
import { draftRouter } from "./routes/draft.js";
import { preflightRouter } from "./routes/preflight.js";
import { pricerRouter } from "./routes/pricer.js";
import { sendRouter } from "./routes/send.js";
import { invoicesRouter } from "./routes/invoices.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { devRouter } from "./routes/dev.js";

dotenv.config();

export const app: Express = express();

// Configure CORS: allows only APP_BASE_URL (plus localhost:8080 when NODE_ENV is not production)
const allowedOrigins: string[] = [];
if (process.env.APP_BASE_URL) {
  allowedOrigins.push(process.env.APP_BASE_URL.trim().replace(/\/+$/, ""));
}
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:8080");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server, verification scripts)
      if (!origin) return callback(null, true);
      const normalized = origin.trim().replace(/\/+$/, "");
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Capture raw body for PayPal webhook signature verification (API-13 & Hard Rule 8)
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString("utf-8");
    },
  })
);

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
app.use("/api/dev", devRouter);

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
