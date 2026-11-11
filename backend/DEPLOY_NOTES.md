# Render Deployment Guide — PreFlight Backend

This document details the configuration and environment setup for deploying `backend/` on Render as a Node.js Web Service.

---

## 1. Verification of Requirements

1. **Host Binding & Port:**
   - Server listens on `Number(process.env.PORT) || 8000` and explicitly binds to host `0.0.0.0` in `backend/src/index.ts`.
2. **CORS Restrictions:**
   - Configured in `backend/src/app.ts` to allow only `process.env.APP_BASE_URL`.
   - When `process.env.NODE_ENV !== "production"`, `http://localhost:8080` is also permitted.
3. **Build & Start Scripts:**
   - `package.json` scripts:
     - `"build": "tsc"`
     - `"start": "node dist/backend/src/index.js"`
   - `typescript` is in `dependencies` so `tsc` is available even when Render runs production installs.
   - All relative imports use `.js` extensions, allowing the compiled code in `dist/backend/` to natively import compiled modules from `dist/shared/`.
   - **Render Root Directory Question:** The Render root directory does **not** have to be the repo root; setting it to `backend/` works because `tsc` includes `../shared/**/*.ts` and outputs a self-contained `dist/` folder containing both `dist/backend/` and `dist/shared/`.
4. **PayPal Webhooks & Healthcheck:**
   - `app.use(express.json({ verify: ... }))` captures the raw request body as `req.rawBody` for `verifyWebhookSignature`.
   - `GET /api/health` returns `{ status: "ok", timestamp, env, demoMode }`.
5. **Idempotency Keys Storage (2-Line Answer):**
   - Idempotency keys were stored in memory (`idempotencyCache = new Map()`) and inside the `preflight_summary` JSONB column; they are now moved to a unique column in the `invoices` table.
   - SQL to run in Supabase: `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE; CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_idempotency_key ON invoices (idempotency_key);`
6. **PAYPAL_ENV Guard:**
   - In `backend/src/index.ts`, the process immediately checks `if (process.env.PAYPAL_ENV !== "sandbox")` and exits with code 1, aborting startup before loading routes or database connections.

---

## 2. Render Web Service Settings

Configure the following fields in the Render dashboard:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Service Type** | Web Service | Node environment |
| **Root Directory** | `backend` | Can also be repo root `.` (see alternative below) |
| **Environment** | `Node` | Node.js runtime |
| **Build Command** | `npm install && npm run build` | Runs `tsc` to compile `backend/` and `shared/` |
| **Start Command** | `npm start` | Executes `node dist/backend/src/index.js` |
| **Node Version** | `20.x` or `22.x` | Set `NODE_VERSION=20.18.0` in Render env |

*(Alternative: If Root Directory is set to repo root `.`, use Build Command: `npm install --prefix backend && npm run build --prefix backend` and Start Command: `node backend/dist/backend/src/index.js`)*

---

## 3. Environment Variable Names (Render Dashboard)

> [!IMPORTANT]
> Never commit actual secret values to git. Add these variable names in Render under **Environment**:

- `NODE_ENV` (e.g. `production`)
- `PORT` (automatically injected by Render, defaults to 10000 on Render)
- `APP_BASE_URL` (URL of the deployed frontend web application, e.g. `https://preflight.onrender.com`)
- `PAYPAL_ENV` (Must be strictly `sandbox`)
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_INVOICER_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LLM_API_KEY`
- `LLM_MODEL`
- `DEMO_MODE` (`false` in production, `true` for demo sandbox reseeding)
