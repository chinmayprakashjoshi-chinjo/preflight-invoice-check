import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Candidate paths for frontend/dist depending on dev vs compiled execution
const candidateDistPaths = [
  path.resolve(__dirname, "../../frontend/dist"),
  path.resolve(__dirname, "../../../../frontend/dist"),
  path.resolve(process.cwd(), "frontend/dist"),
  path.resolve(process.cwd(), "../frontend/dist"),
];
const frontendDistPath =
  candidateDistPaths.find((dir) => fs.existsSync(dir)) ??
  path.resolve(__dirname, "../../frontend/dist");

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

// 404 handler for unknown /api/* routes (PRD error format)
app.all(["/api", "/api/*"], (req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `API endpoint not found: ${req.method} ${req.originalUrl || req.path}`,
      details: {},
    },
  });
});

// Serve frontend static files only if the folder exists (check with fs.existsSync)
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get("*", (_req: Request, res: Response) => {
    const indexPath = path.join(frontendDistPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath, (err) => {
        if (err && !res.headersSent) {
          res.status(404).json({
            error: {
              code: "NOT_FOUND",
              message: "Not found",
              details: {},
            },
          });
        }
      });
    } else {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Frontend index.html not found",
          details: {},
        },
      });
    }
  });
} else {
  // If it does not exist, GET / must return JSON service status
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      service: "preflight-backend",
      status: "ok",
      health: "/api/health",
    });
  });
}

// Any other unknown non-/api path must return 404 JSON, never a 500 or a crash
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Cannot ${req.method} ${req.originalUrl || req.path}`,
      details: {},
    },
  });
});

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
