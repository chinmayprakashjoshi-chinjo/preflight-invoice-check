import dotenv from "dotenv";
import path from "node:path";

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

const PORT = Number(process.env.PORT) || 8000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`[PreFlight Backend] Server is running on http://${HOST}:${PORT}`);
  console.log(`[PreFlight Backend] Healthcheck available at http://${HOST}:${PORT}/api/health`);
});
