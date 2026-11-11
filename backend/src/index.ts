import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });

// Refuse to start if PAYPAL_ENV is not 'sandbox' per CLAUDE.md Hard Rule 12
if (process.env.PAYPAL_ENV !== "sandbox") {
  console.error(
    `[PreFlight Backend] FATAL: PAYPAL_ENV must be set to 'sandbox'. Received: '${process.env.PAYPAL_ENV}'. Server startup aborted.`
  );
  process.exit(1);
}

const { default: app } = await import("./app.js");

// Resolve static frontend build folder relative to backend source (../../frontend/dist)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");

// Serve static frontend build folder
app.use(express.static(frontendDistPath));

// Catch-all route to properly support React Router navigation in monolithic deployment
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

const PORT = Number(process.env.PORT) || 8000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`[PreFlight Backend] Server is running on http://${HOST}:${PORT}`);
  console.log(`[PreFlight Backend] Healthcheck available at http://${HOST}:${PORT}/api/health`);
});
