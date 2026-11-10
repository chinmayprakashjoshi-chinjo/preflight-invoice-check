# CLAUDE.md — PreFlight Backend Rules

Repo layout: backend/ (Express API, port 8000), frontend/ (TanStack Start), shared/ (shared code).

Read `docs/BACKEND_PRD.md` first. It is the source of truth for backend behaviour, API contracts and the database. For *current frontend behaviour*, the code wins.

## What this project is
PreFlight checks a freelancer's invoice against the client's AP rules before sending, computes the amount to invoice for a target net after PayPal fees and FX, sends it via PayPal Sandbox, and tracks Sent to Paid.

## Stack
- TypeScript everywhere
- TanStack Start (React, Vite), Tailwind, shadcn/ui, AG Grid
- Backend: Node + Express (TypeScript) in backend/, runs on port 8000, same API contract as the PRD. Shared pure logic is imported from shared/.
- Zod, Vitest
- Supabase Postgres + private Storage bucket `ap-documents` (via `@supabase/supabase-js`, service key, server only)
- PayPal REST Invoicing API v2 via `fetch`. **Do not use `@paypal/paypal-server-sdk`** for invoicing.
- LLM API (model from `LLM_MODEL`), server-side only
- Hosting: Render (preferred) or Cloudflare Workers

## Key files
- `frontend/src/lib/api.ts` — the only frontend data-access layer (`VITE_USE_MOCKS` switch)
- `shared/types.ts` — canonical types and Zod schemas
- `shared/preflight.ts` — pre-flight rules (pure; the server imports it unchanged)
- `shared/pricer.ts` — ALL money math
- `shared/pricing-config.ts` — placeholder rates and pricing config
- `shared/format.ts` — pure currency and date formatting utilities
- `shared/index.ts` — barrel export for shared modules
- `frontend/src/lib/parse-draft.ts` — one-line draft parser
- `frontend/src/mocks/*` — seed data (clients.ts, invoices.ts, profile.ts)

## Hard rules
1. **Money math only in `pricer.ts`.** Decimal-safe or integer cents, round once at the end. API money values are strings with 2 decimals plus a currency code. No floats in payloads.
2. **Never reimplement `preflight.ts` or `pricer.ts` on the server.** Import them.
3. **Every LLM output is Zod-validated.** Retry once, then return a typed error.
4. **Blockers come only from code rules.** LLM findings are warnings only.
5. **Never invent data.** Rules not in the source are omitted. Every extracted rule's `evidence` must be verified to exist in the source text (normalise case, whitespace, quotes and dashes). Unverified means `confidence: "low"` or dropped.
6. **`POST /api/send` is authoritative.** It re-runs pre-flight and returns `422 BLOCKERS_PRESENT` if any blocker exists.
7. **`/api/send` is idempotent** per `idempotencyKey`. Never create a second PayPal invoice. Never leave a `sent` row without `paypal_invoice_id`. If creation succeeded but send failed, keep the PayPal ID on the draft and resume at the send step on retry.
8. **Webhooks:** read the raw body, verify the signature via `/v1/notifications/verify-webhook-signature`, insert into `webhook_events` (unique `event_id`, `processed_at = null`), apply the update, then set `processed_at`. Skip only if a duplicate is already processed; retry if it is not. Read the invoice ID as `resource.id`, falling back to `resource.invoice.id`.
9. **`overdue` is derived at read time** (`sent` and `due_date < today`). Never store it.
10. **No reminders, no Cancelled status, no Dispute Evidence Pack.** They must not exist in UI or API.
11. **PayPal `PUT` replaces the whole object:** `GET`, modify, then `PUT`.
12. **Sandbox only.** `PAYPAL_ENV=sandbox`. Guard against the live base URL. USD and EUR only.
13. **Secrets only in server env**, never `VITE_*`, never in git (the repo is public). Never log secrets, PayPal tokens or full documents.
14. **No RLS reliance.** No table is exposed to the browser; all DB access goes through the server.

## Error format
```json
{ "error": { "code": "BLOCKERS_PRESENT", "message": "Resolve 2 blockers before sending.", "details": {} } }
```
Codes: `VALIDATION_ERROR` 400, `NOT_FOUND` 404, `BLOCKERS_PRESENT` 422, `EXTRACTION_FAILED` 502, `PAYPAL_ERROR` 502 (include PayPal `debug_id`), `RATE_LIMITED` 429, `INTERNAL` 500.

## Endpoints (see PRD section 8.3 for full contracts)
`GET /api/clients`, `GET /api/clients/:id`, `POST /api/requirements`, `PATCH /api/requirements/:id`, `POST /api/requirements/learn` (P1), `POST /api/draft`, `POST /api/preflight`, `POST /api/pricer`, `POST /api/send`, `GET /api/invoices`, `GET /api/invoices/:id`, `POST /api/invoices/:id/mark-paid`, `POST /api/webhooks/paypal`, `POST /api/dev/reset` (only if `DEMO_MODE=true`).

## Environment variables (names only; never commit values)
Client: `VITE_USE_MOCKS`, `VITE_API_BASE_URL`
Server: `PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_INVOICER_EMAIL`, `LLM_API_KEY`, `LLM_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASE_URL`, `DEMO_MODE`

## Workflow
- Schema first (Zod and types), then code on top.
- One feature, one prompt, one commit. Keep formatting-only commits separate.
- Before writing PayPal code, check the PayPal docs, and test each PayPal call once in Postman. Do not guess field names.
- Paste full errors back instead of guessing.
- Components must not change when `VITE_USE_MOCKS` flips. Validate real responses with the same Zod schemas as the mocks.
- Run the demo path on the deployed URL regularly, not only on localhost.
- Feature freeze is tonight (10 Nov). After that: bug fixes, polish and the demo video only.

## Cut order if behind
FR-09 learn-from-email, then FR-10 polling and FR-12 reset, then the AI soft warning, then persistence of requirement edits.
**Never cut:** real PayPal send, server-side send gate, evidence-verified extraction, webhook (or polling) status update.
