# PreFlight: Product Requirements Document (v2)

| | |
|---|---|
| **Product** | PreFlight, an invoice co-pilot for freelancers |
| **Version** | 2.0 (supersedes the earlier Claude Doc "PreFlight: PRD, Tech Stack aur Roadmap (2 log, 5 din)", referred to below as **PRD v1**) |
| **Date** | 10 Nov 2026 |
| **Team** | 2 people (Person A: backend, PayPal, database, deploy. Person B: frontend, AI prompts, demo video) |
| **Event** | PayPal AI Hackathon (Devpost). Deadline reported as 12 Nov 2026 by PayPal's blog; another source says 13 Nov 1:30 AM IST. **Verify on the Devpost page and submit early.** |
| **Audience of this file** | Humans and coding agents (Claude Code) implementing the backend and database. Use it as the reference in the repo (e.g. `docs/PRD.md`). |

> **How to read this file.** Sections 1 to 6 explain *what* and *why*. Sections 7 to 14 are the *functional spec* (frontend as built, backend, API, database, PayPal, AI). Sections 15 to 20 cover deployment, security, testing, schedule and open questions. Requirement IDs (`FR-xx`, `API-xx`, `DB-xx`, `NFR-xx`) are stable and can be quoted in commits and tasks.
>
> **Source-of-truth rule.** Where this document and the code disagree about *current frontend behaviour*, the code wins and this document must be corrected. Where they disagree about *intended backend behaviour*, this document wins.

---

## 1. Problem statement

### 1.1 The problem

A solo freelancer (typical: India-based, invoicing international startup or SMB clients through PayPal) completes work and sends an invoice. Weeks later the invoice comes back or stalls because the client's **accounts-payable (AP)** process rejected it for boring, avoidable reasons:

- the **PO number** is missing,
- the invoice is addressed to the wrong **legal entity name**,
- the **currency** is not one the client's AP accepts,
- a required **VAT / tax ID** is missing,
- **payment terms** do not match the client's terms,
- the invoice was sent to the wrong **AP email address**.

The freelancer only finds out after a long delay, because AP teams rarely explain, and the freelancer has no accountant. A second problem compounds the first: after **PayPal fees and currency conversion**, the freelancer receives **less than they quoted**, and does not know the real cost before pricing the work.

### 1.2 What PreFlight does

PreFlight acts as a "pre-flight checklist" for an invoice. It:

1. **Reads the client's AP rules** from the documents the client gave (vendor guide, onboarding email, PDF) and turns them into a checklist, every rule backed by an exact quote from the source.
2. **Checks the invoice draft against those rules before it is sent**, labelling each problem as a *blocker* or a *warning* and offering a one-click fix where possible.
3. **Shows what the freelancer will really net** after PayPal fees and FX, and what to invoice to land a target amount (the *Net-Landing Pricer*).
4. **Sends the invoice through PayPal** (Sandbox for the hackathon) and **tracks it** from Sent to Paid.

### 1.3 What PreFlight is not (important clarifications)

- It does **not approve or reject a project or a client.** It clears or blocks **invoices**. The "go" signal is "Cleared for send", not "accept the project".
- It does **not give legal advice** or review contracts. It checks paperwork against the client's own stated AP rules.
- It does **not fix problems automatically behind the user's back.** It flags, explains with evidence, and proposes a fix. The freelancer decides.
- It cannot prevent a client from paying late for their own reasons. It removes the *avoidable* delay caused by rejected or incomplete invoices.

### 1.4 User

**Primary persona:** a solo freelancer / consultant, no team, no accountant, invoicing a few international clients, getting paid by PayPal. Pain: wasted weeks chasing rejected invoices, and surprise fee losses.

### 1.5 End-to-end user journey (reference story)

1. **Kickoff (once per client).** Freelancer gets work from Acme. Acme's vendor guide goes into **Clients**; AI extracts the rules with evidence quotes. Freelancer can already see "PO required" before starting work and can ask Acme for a PO.
2. **Quote.** In **Pricer**, freelancer enters the net amount they want ($1,000). PreFlight returns the amount to invoice (about $1,046 with the placeholder rates in section 12) with fee, FX and effective cost shown separately.
3. **Invoice.** After the work, in **New invoice** the freelancer types one line: "Invoice Acme Corp $1,046 for site redesign". A structured draft appears.
4. **Pre-flight.** The right-hand panel shows blockers (PO missing, wrong legal entity), a warning (vague description) and passed checks. Each issue has an evidence quote and a fix button. **Send** stays disabled until blockers are resolved.
5. **Send.** "Cleared for send" turns green. Clicking it creates and sends the invoice through PayPal. A success card shows the PayPal invoice ID and payer link.
6. **Track.** **Invoices** shows the status moving Sent to Paid, updated by a PayPal webhook (or by the sandbox "Mark paid" action in the demo).

---

## 2. Goals, non-goals, success metrics

### 2.1 Goals (this hackathon)

| # | Goal |
|---|---|
| G1 | Catch avoidable invoice rejection reasons **before** sending, with evidence. |
| G2 | Compute the invoice amount that lands a target net, with an honest fee and FX breakdown. |
| G3 | Send a **real PayPal Sandbox invoice** and show real status changes. |
| G4 | Use AI **meaningfully but safely** (reading documents, drafting, explaining) while keeping all money math deterministic. |
| G5 | Ship a deployed URL, a public repo, and a 3-minute demo video. |

### 2.2 Non-goals (explicit cuts)

Dispute Evidence Pack; reminders and collections (crowded space, also removed from the UI); multi-user accounts, auth, billing, subscriptions; GST/TDS and other tax compliance; mobile app; contract/legal review; recurring invoices; accounting integrations; charts/analytics; dark mode.

### 2.3 Success metrics

- End-to-end demo runs in under 3 minutes with no manual fixes.
- At least **three distinct issue types** are caught on demo data (missing PO, entity mismatch, wrong currency).
- A real sandbox invoice is created, sent, appears as **UNPAID** in the sandbox Business account, then becomes **PAID**, and the app reflects it.
- Deployed URL is live and a public webhook endpoint receives events.

---

## 3. Scope summary

| Area | In scope (P0) | In scope (P1) | Out of scope |
|---|---|---|---|
| Client rules | Extract from pasted text or uploaded PDF, with evidence | Learn from a pasted rejection email | Auto-negotiation with client |
| Invoice | One-line draft, editable form, preview | Template styling | Multi-page templates |
| Pre-flight | Rule engine (code) + soft AI warnings, fix buttons, server-side send gate | n/a | Legal review |
| Pricer | Target net to gross, fee, FX, effective cost, editable placeholder rates | n/a | Live PayPal fee lookup |
| PayPal | Create, send, get, record payment (sandbox), webhook verify | n/a | Orders/Checkout, Vault, subscriptions, refunds UI |
| Tracking | Draft / Sent / Paid / Overdue (derived) | n/a | Cancelled/refunded views |

---

## 4. Changes since PRD v1 (change log)

| Topic | PRD v1 | This version | Reason |
|---|---|---|---|
| Frontend framework | Next.js App Router | **TanStack Start (React, Vite)** as generated by Lovable and extended with Claude Code | Frontend was built in Lovable; migration judged too risky for the timeline. |
| Backend location | Next.js API routes | **Server functions / server routes in the same TanStack Start app** (preferred), fallback: separate Express service | Decide after inspecting the installed TanStack Start version (see 19.1). |
| Reminders (FR9) | P2 feature | **Removed** ("Remind" button deleted) | Out of scope per problem statement; crowded space. |
| Cancelled status | Not specified | **Removed** from UI and mocks | Not part of the unpaid to paid story. |
| Landing page | Not specified | **Added** (6 sections, pill navbar, FAQ) | Product explanation for judges and demo opening. |
| Routing | Single app | Landing at `/`, app under `/app/*` | Separate marketing from product. |
| Brand | n/a | New logo, favicon, mint/indigo landing look | Polish. |
| Pre-flight on load | Empty until client chosen | **Pre-filled demo case** (2 blockers, 1 warning, 3 passes) | Hero demo moment. |
| Send result | Not specified | **Success card** with PayPal invoice ID, status, payer link | Proves PayPal integration. |
| Invoices table | Basic grid | AG Grid with PayPal ID, "Updated via webhook" column | Proves webhook tracking. |
| API layer | Direct calls | `src/lib/api.ts` with `VITE_USE_MOCKS` switch and Zod schemas | Allows swapping mocks for the real backend without touching components. |
| Rejection-email learning (FR8) | P1 | **Built in the UI as a mock** (P1 backend pending) | Optional if time. |
| Demo helper | n/a | "Reset demo data" button | Repeatable demo recording. |

---

## 5. Functional requirements (master list)

Priority: **P0** must ship, **P1** if time allows, **P2** cut.
Status: **FE** = frontend built (mock-backed), **BE** = backend to build.

| ID | Requirement | Acceptance criteria | Pri | Status |
|---|---|---|---|---|
| FR-01 | **Client AP requirements extraction** from pasted text or uploaded PDF | For each of 3 demo clients, extraction returns a schema-valid list (PO required, legal entity, tax ID, AP email, accepted currencies, payment terms, other). Every item has an `evidence` quote that **exists verbatim in the source text**. | P0 | FE done, BE todo |
| FR-02 | **Edit requirements** | User can edit any extracted value; edits persist and mark the item `source: "user"`. | P0 | FE done, BE todo |
| FR-03 | **Draft from one line** | "Invoice Acme Corp $1,200 for site redesign" yields client, amount, description, currency, due date; client matched to a known client by name when possible. | P0 | FE done (parser), BE optional |
| FR-04 | **Pre-flight check** | Rule engine returns issues with severity, message, evidence, fix. Re-runs live in the UI on every change. **Server re-runs it at send time and refuses to send if any blocker exists (HTTP 422).** | P0 | FE done, BE todo |
| FR-05 | **Net-Landing Pricer** | Given target net, currency and FX flag, returns gross, PayPal fee, FX cost (separate), effective cost %. Rates are editable placeholders. Unit-tested. | P0 | FE done, BE todo (shared module) |
| FR-06 | **Send via PayPal (Sandbox)** | Creates a draft invoice, sends it, stores PayPal invoice ID, payer view URL and status. UI shows the success card. | P0 | FE mock, BE todo |
| FR-07 | **Status tracking by webhook** | `INVOICING.INVOICE.PAID` (and SENT) webhooks are signature-verified, de-duplicated by event ID, and update the invoice. UI shows "Paid via webhook, <time>". | P0 | FE mock, BE todo |
| FR-08 | **Sandbox "Mark paid"** | Records a sandbox payment via PayPal; the resulting webhook (or a direct status refresh) moves the invoice to Paid. | P0 | FE mock, BE todo |
| FR-09 | **Learn from rejection email** | Pasting a client's rejection email adds a new requirement with evidence and a "New" badge. | P1 | FE mock, BE todo |
| FR-10 | **Polling fallback** | If webhooks are unavailable, the Invoices page can refresh statuses via `GET /api/invoices?refresh=true`. | P1 | BE todo |
| FR-11 | **Landing page** | `/` explains the product in 6 sections; all CTAs go to `/app/new-invoice`. | P0 | FE done |
| FR-12 | **Demo reset** | "Reset demo data" restores seed state (frontend store now; backend: `POST /api/dev/reset`, disabled in production unless `DEMO_MODE=true`). | P1 | FE done, BE todo |
| FR-X | *(removed)* Reminders, Cancelled status, Dispute Evidence Pack | Must not exist in UI or API. | n/a | removed |

### Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Money math is deterministic code.** No LLM output is ever used as a monetary value. |
| NFR-02 | **Secrets stay on the server** (PayPal secret, LLM key, DB service key). Never exposed through `VITE_*` variables or committed (repo is public). |
| NFR-03 | Every LLM response is **Zod-validated**; on failure retry once, then return a typed error. |
| NFR-04 | Every extracted rule has an **evidence quote that is verified server-side** to exist in the source text. Rules failing verification are dropped or flagged `confidence: "low"`. |
| NFR-05 | Webhook handler is **idempotent** (unique event ID) and **verifies the signature** before any state change. |
| NFR-06 | Interactive API calls return within 10 s (LLM calls within 30 s). The UI always shows loading, empty and error states. |
| NFR-07 | Accessibility: color is never the only signal (icon plus text), 4.5:1 contrast, keyboard operable. |
| NFR-08 | Light theme only; Inter font; tokens defined once (CSS variables), no hardcoded hex in components. |

---

## 6. Business rules (single source for pre-flight and status logic)

### 6.1 Pre-flight rules

Implemented as a **pure function** (`src/lib/preflight.ts`): `preflight(invoice, requirements) => Issue[]`. The backend must **import and reuse the same module** (no re-implementation).

| Rule ID | Condition | Severity | Fix offered |
|---|---|---|---|
| PF-01 | Client requires PO and `invoice.poReference` is empty | **Blocker** | "Add PO" (focus the field) |
| PF-02 | `invoice.billTo` differs from required legal entity (case/whitespace-insensitive exact match) | **Blocker** | "Use legal name" (apply value) |
| PF-03 | `invoice.currency` not in client's accepted currencies | **Blocker** | "Switch to <currency>" |
| PF-04 | Client requires VAT/tax ID and `invoice.taxId` is empty | **Blocker** | "Add VAT ID" |
| PF-05 | Payment terms differ from client's terms | Warning | "Use Net N" |
| PF-06 | Description under 3 words or generic ("services", "work", "design work") | Warning (soft; optionally AI-assisted) | "Improve" (suggest text) |
| PF-07 | `invoice.sendTo` equals client's AP email (pass) or differs (blocker if AP email is a strict requirement) | Pass / Blocker | "Use AP email" |
| PF-08 | One-invoice-per-file or similar structural rule from client doc | Warning | informational |

Issue shape: `{ id, ruleId, severity: "blocker"|"warning"|"pass", title, message, evidence, fixLabel?, fixField?, fixValue? }`.

**Send gate:** `canSend = blockers.length === 0`. Warnings never block.

### 6.2 Invoice status model

| App status | Meaning | Source |
|---|---|---|
| `draft` | Created locally, not sent | local |
| `sent` | Sent through PayPal, unpaid | PayPal `SENT`/`UNPAID` |
| `paid` | Payment received or recorded | PayPal `PAID` / `MARKED_AS_PAID` |
| `overdue` | `sent` and `due_date < today` | **derived** at read time, not stored |

Mapping from PayPal statuses is a function `mapPayPalStatus()`; unknown statuses default to `sent` and are logged. (Verify the full PayPal status list against the Invoicing API reference during implementation.)

---

## 7. Frontend as built (reference for backend contracts)

### 7.1 Stack and structure

- **TanStack Start** (React + TypeScript, Vite), file-based routes, Tailwind CSS + shadcn/ui, **AG Grid** (`ag-grid-react`) for the invoices table, **Zod**, **Vitest**, Bun lockfile present (`bun.lock`) plus npm usage.
- Repo: `github.com/chinmayprakashjoshi-chinjo/preflight-invoice-check` (public). Default branch `main`; feature work merged via PR from `feat/landing-and-prd-alignment`.
- Dev server default port **5190** (as observed).

### 7.2 Routes

| Route | Screen | File |
|---|---|---|
| `/` | Landing page | `src/routes/index.tsx` + `src/components/landing/Landing.tsx` |
| `/app` | Redirects to `/app/new-invoice` | `src/routes/app.index.tsx` |
| `/app/new-invoice` | **Hero screen**: one-line draft, form, pre-flight panel, send | `src/routes/app.new-invoice.tsx` |
| `/app/clients` | Clients and AP requirements | `src/routes/app.clients.tsx` |
| `/app/pricer` | Net-Landing Pricer | `src/routes/app.pricer.tsx` |
| `/app/invoices` | Invoice list and tracking (AG Grid) | `src/routes/app.invoices.tsx` |
| Layout | App shell with sidebar | `src/routes/app.tsx`, `src/components/layout/AppSidebar.tsx` |

Clicking the **PreFlight logo** (landing navbar, footer, app sidebar) navigates to `/`.

### 7.3 Key components and modules

| Path | Role |
|---|---|
| `src/components/new-invoice/` | `QuickDraftCard`, `DraftInvoiceForm`, `PreflightPanel`, `SendArea`, `SentState`, `InvoicePreviewDialog`, `draft-utils.ts` |
| `src/components/preflight/` | `EmptyState`, `PreflightResultPill`, `StatusChip` (and issue/severity components) |
| `src/components/clients/` | `DocumentDropzone` (upload + paste), `RequirementsTable`, `RequirementEditDialog` |
| `src/components/invoices/InvoicesGrid.tsx` | AG Grid table |
| `src/lib/api.ts` | **The only data-access layer.** Typed async functions; mock or real via env switch |
| `src/lib/types.ts` | Types and Zod schemas (canonical; this PRD's TypeScript is indicative) |
| `src/lib/preflight.ts` (+ `.test.ts`) | Rule engine |
| `src/lib/pricer.ts` / `src/config/pricing-config.ts` (+ `pricer.test.ts`) | Pricing math and placeholder rates (confirm exact paths in repo) |
| `src/lib/parse-draft.ts` | One-line parser |
| `src/lib/queries.ts`, `src/lib/requirements.ts` | Query hooks and requirement helpers |
| `src/mocks/clients.ts`, `src/mocks/invoices.ts` | Seed data |

### 7.4 Screen behaviour

**Landing (`/`).** Floating pill navbar (logo, "How it works", "FAQ", mint "Try the demo"); indigo hero with headline "Check the invoice before you send it." and a floating collage (Blocker card, Warning card, "Cleared for send" pill); "Three steps. No surprises." cards linking to Clients, New invoice, Pricer; indigo highlight band ("Catch it before accounts payable does."); FAQ accordion (4 questions); closing CTA band and footer.

**New invoice.**
- Header actions: "Preview" (dialog) and "Send via PayPal".
- "Describe the invoice" card: one text input plus "Generate draft" (parses client, amount, description; loading state).
- Two columns: left **Draft invoice** form (client account, bill-to name, send-to email, currency, payment terms, PO reference, VAT ID, invoice date, due date auto-computed from terms, line items with add/remove, total); right **Pre-flight check** panel (count chips, issue cards with evidence and fix buttons, compact passed-checks list, send area).
- **Pre-filled demo state on load:** client Acme Corporation Ltd, bill-to "Acme Corp" (deliberately wrong), no PO, USD, Net 30, "Site redesign" $1,200, giving 2 blockers, 1 warning, 3 passes.
- Send button: disabled with lock icon and helper text "Resolve N blockers before sending" when blockers exist; green "Cleared for send" otherwise; warnings do not block.
- Switching currency to EUR for Acme produces a third blocker type (PF-03).
- After send: success card (status chip Sent, PayPal invoice ID, amount, client, due date, "Copy payer link", "Open payer link", "View in Invoices").

**Clients.** Client list plus detail panel. Documents input has two tabs: **Upload** (PDF dropzone) and **Paste text**, with "Extract requirements" (loading state). Requirements table: Requirement, Value, Evidence quote, Confidence badge, Edit. "AI-extracted" label. Error state "Document unreadable" only for empty/non-PDF input. P1 card: "Paste a rejection email" to "Learn from this email" (adds a row with a "New" badge). Demo clients: **Acme Corporation Ltd** (PO required, exact legal entity, USD only, Net 30, AP email), **Northwind Studio** (no PO, EUR, VAT ID required, Net 15), **Globex Inc** (PDF vendor guide, one invoice per file, separate AP email, Net 45).

**Pricer.** Inputs: target net, invoice currency, "Client pays in a different currency" toggle. Output card: invoice amount to send (teal, tabular), PayPal fee, FX spread (separate line), effective cost %, one-line explanation. Collapsible **Rates** panel with editable fee %, fixed fee, FX spread % and the note "Placeholder rates, update from PayPal's current pricing". "Use this amount in a new invoice" navigates to `/app/new-invoice` with the amount pre-filled. (Currently the page calls the pure function directly rather than `api.calcPricing`.)

**Invoices.** Four KPI cards (Draft, Sent unpaid, Paid, Overdue with count and amount); search and status filter; AG Grid columns: Invoice #, Client, Amount, Currency, Status chip, Due date, PayPal invoice ID, Pre-flight result, Updated, Actions. Actions: **Mark paid (sandbox)** for Sent/Overdue, **Open payer link** for sent invoices. Marking paid shows a loading state, sets status Paid, shows "Paid via webhook, just now" and a toast "INVOICING.INVOICE.PAID webhook received (sandbox)" (simulated until the backend exists).

### 7.5 Design tokens (frontend contract)

Background `#F8FAFC`, surface `#FFFFFF`, border `#E2E8F0`, text `#0F172A`, muted `#64748B`, primary indigo `#4338CA` (deep `#312E81`, tint `#EEF2FF`), money teal `#0D9488`, landing CTA mint `#5EEAD4`. Status: Blocker `#DC2626` on `#FEF2F2`; Warning `#D97706` on `#FFFBEB`; Pass `#16A34A` on `#F0FDF4`; Info `#0284C7` on `#F0F9FF`. Radii: 8px controls, 12 to 20px cards, 32px landing blocks. No PayPal logo or PayPal blue anywhere. A small "PayPal Sandbox" badge appears in the sidebar footer.

### 7.6 Known frontend issues (carry into the backlog)

1. Invoices grid scrolled horizontally at 1440px (fix prompt issued; verify).
2. "Reset demo data" reloads the page to clear local state; backend reset will replace this.
3. Pricer page bypasses `api.calcPricing`; acceptable, but the shared pure function must remain the single implementation.
4. `eslint --fix` reformatted unrelated files in one commit; keep formatting commits separate.
5. Real-API mode (`VITE_USE_MOCKS=false`) is **untested**: it uses `fetch` plus Zod validation and is typechecked only.

---

## 8. Architecture

```
Browser (React, TanStack Start routes)
   |  src/lib/api.ts  (VITE_USE_MOCKS=false  ->  fetch /api/...)
   v
Server layer (same TanStack Start app, preferred)
   |-- /api/requirements  -> LLM  (extract rules)
   |-- /api/draft         -> parser / LLM (optional)
   |-- /api/preflight     -> shared preflight.ts (+ optional LLM soft warnings)
   |-- /api/pricer        -> shared pricer.ts
   |-- /api/send          -> re-run preflight -> PayPal create + send + get
   |-- /api/invoices      -> DB (+ PayPal refresh)
   |-- /api/invoices/:id/mark-paid -> PayPal record payment
   |-- /api/webhooks/paypal -> verify signature -> dedupe -> update DB
   v
Supabase Postgres + Storage        PayPal Sandbox (REST)        LLM API
```

**Principles.**
1. One data-access seam on the client (`api.ts`), one set of Zod schemas on both sides.
2. **Pure business logic is shared**: `preflight.ts` and `pricer.ts` are imported by the server unchanged.
3. The server is **authoritative** for sending: it recomputes pre-flight and rejects blocked invoices.
4. PayPal is the source of truth for payment status; the database caches it and stores PreFlight-specific data.
5. If TanStack Start server routes prove unsuitable (see 19.1), the same endpoints are implemented in a small Express service in the same repo; the API contract in section 10 does not change.

### 8.1 Tech stack (consolidated)

| Layer | Choice | Notes |
|---|---|---|
| Language | **TypeScript** everywhere (frontend, backend, shared modules) | One language so `preflight.ts`, `pricer.ts` and Zod schemas are shared without rewriting |
| Frontend | TanStack Start (React, Vite), Tailwind CSS, shadcn/ui, AG Grid (`ag-grid-react`) | Already built |
| Backend | TanStack Start **server functions / server routes** in the same repo (fallback: Node + Express) | Confirm syntax for the installed version (19.1) |
| Validation | **Zod** | API input and output, LLM output |
| Database | **Supabase Postgres** (relational, section 14) | Accessed from the server with `@supabase/supabase-js` and the service key |
| File storage | **Supabase Storage** (private bucket `ap-documents`) | Uploaded PDFs |
| PayPal | **REST Invoicing API v2 via `fetch`**, OAuth2 client credentials, webhooks | No PayPal SDK (no Invoicing controller in `@paypal/paypal-server-sdk`) |
| AI | Any LLM API with structured JSON output (default a Claude Sonnet model), called server-side only | Model from `LLM_MODEL` |
| PDF text extraction | A small server-side PDF-to-text library (for example `unpdf` or `pdf-parse`; choose at implementation time and check it runs on the chosen host) | Needed to verify evidence quotes |
| Testing | **Vitest** (unit and contract tests), **Postman** (manual PayPal call checks) | Postman is a testing tool, not part of the app |
| Hosting | **Render** web service (preferred) or Cloudflare Workers | Public HTTPS URL needed for the webhook (section 15) |
| Local webhook testing | ngrok or cloudflared tunnel | Only before the first deploy |
| Version control | Git and GitHub (public repo), feature branches merged by pull request | No secrets in git |

**Deliberately not used:** MongoDB (the data is relational: clients, requirements, invoices, items), FastAPI or any Python service (second language, second deploy, duplicated schemas, no shared pure functions), `@paypal/paypal-server-sdk` for invoicing, PayPal JS SDK or checkout buttons, any auth provider (single-tenant demo).

---

## 9. Environment variables

Names only. **Never commit values.** Server-only variables must **not** start with `VITE_`.

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_USE_MOCKS` | client | `true` (default) uses mocks; `false` calls the real API |
| `VITE_API_BASE_URL` | client | Base URL for the API (empty = same origin) |
| `PAYPAL_ENV` | server | `sandbox` (default) or `live` (never live for the hackathon) |
| `PAYPAL_CLIENT_ID` | server | Sandbox REST app client ID |
| `PAYPAL_CLIENT_SECRET` | server | Sandbox REST app secret |
| `PAYPAL_WEBHOOK_ID` | server | ID of the webhook registered in the developer dashboard |
| `PAYPAL_INVOICER_EMAIL` | server | Sandbox Business account email (invoice sender) |
| `LLM_API_KEY` | server | LLM provider key |
| `LLM_MODEL` | server | Model ID (default a Claude Sonnet model; cheaper model for light steps) |
| `SUPABASE_URL` | server | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Service key (server only; bypasses RLS) |
| `APP_BASE_URL` | server | Public URL of the deployed app (webhook and links) |
| `DEMO_MODE` | server | `true` enables `POST /api/dev/reset` |

`.env.example` lists all names with empty values. `.env` and `.env.*` (except `.env.example`) are git-ignored.

---

## 10. Backend API specification

**Conventions.** JSON over HTTPS; `Content-Type: application/json` (multipart for file upload). Success returns `200`/`201` with the documented body. Errors return:

```json
{ "error": { "code": "BLOCKERS_PRESENT", "message": "Resolve 2 blockers before sending.", "details": { "blockers": ["PF-01", "PF-02"] } } }
```

Error codes: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `BLOCKERS_PRESENT` (422), `EXTRACTION_FAILED` (502), `PAYPAL_ERROR` (502, include PayPal `debug_id` in details), `RATE_LIMITED` (429), `INTERNAL` (500). Money is represented as **strings with 2 decimals** (`"1046.34"`) plus a `currency` code. No floating-point money in API payloads.

Indicative types (canonical versions live in `src/lib/types.ts`):

```ts
type Currency = "USD" | "EUR";
type Severity = "blocker" | "warning" | "pass";
type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

interface Requirement {
  id: string; clientId: string;
  key: "po_required" | "legal_entity" | "tax_id_required" | "ap_email" |
       "accepted_currencies" | "payment_terms" | "one_invoice_per_file" | "other";
  label: string; value: string | string[] | boolean;
  evidence: string;                    // exact quote from the source
  confidence: "high" | "medium" | "low";
  source: "ai" | "user" | "email";
}

interface InvoiceInput {
  clientId: string | null; billTo: string; sendTo: string;
  currency: Currency; paymentTerms: "NET_15" | "NET_30" | "NET_45";
  poReference: string; taxId: string; invoiceDate: string; dueDate: string;
  items: { description: string; quantity: number; unitPrice: string }[];
}

interface Issue {
  id: string; ruleId: string; severity: Severity;
  title: string; message: string; evidence?: string;
  fixLabel?: string; fixField?: string; fixValue?: string;
}
```

### 10.1 Endpoints

| ID | Endpoint | Request | Response | Notes |
|---|---|---|---|---|
| API-01 | `GET /api/clients` | none | `{ clients: Client[] }` | Each with requirement count |
| API-02 | `GET /api/clients/:id` | none | `{ client, requirements: Requirement[], documents: Doc[] }` | |
| API-03 | `POST /api/requirements` | `{ clientId, text?: string }` or multipart `{ clientId, file: PDF }` | `{ requirements: Requirement[], sourceTextHash }` | LLM extraction; replaces `source: "ai"` rows for that document; keeps user edits |
| API-04 | `PATCH /api/requirements/:id` | `{ value }` | `{ requirement }` | Sets `source: "user"` |
| API-05 | `POST /api/requirements/learn` (P1) | `{ clientId, emailText }` | `{ requirements: Requirement[] }` (new ones, badge "New") | Evidence must exist in `emailText` |
| API-06 | `POST /api/draft` | `{ text }` | `{ invoice: InvoiceInput, matchedClientId }` | Parser first; LLM fallback optional |
| API-07 | `POST /api/preflight` | `{ invoice: InvoiceInput, clientId }` | `{ issues: Issue[], counts: {blockers, warnings, passed}, canSend }` | Uses shared `preflight.ts`; optional soft AI warning PF-06 |
| API-08 | `POST /api/pricer` | `{ targetNet: string, currency, fxApplies: boolean, rates?: Rates }` | `{ gross, fee, fxCost, effectiveCostPct, explanation }` | Shared `pricer.ts` |
| API-09 | `POST /api/send` | `{ invoice: InvoiceInput, clientId }` | `201 { invoice: InvoiceRecord }` (with `paypalInvoiceId`, `payerViewUrl`, `status: "sent"`) | **Re-runs pre-flight; 422 `BLOCKERS_PRESENT` if blockers.** |
| API-10 | `GET /api/invoices` | query `status?`, `q?`, `refresh?=true` | `{ invoices: InvoiceRecord[], kpis }` | `refresh` polls PayPal for non-paid invoices |
| API-11 | `GET /api/invoices/:id` | none | `{ invoice, events: WebhookEvent[] }` | |
| API-12 | `POST /api/invoices/:id/mark-paid` | `{}` | `{ invoice }` | PayPal record-payment, then refresh status |
| API-13 | `POST /api/webhooks/paypal` | raw PayPal event | `200 {}` quickly | Verify, dedupe, update (section 11.4) |
| API-14 | `POST /api/dev/reset` | none | `{ ok: true }` | Only if `DEMO_MODE=true`; reseeds DB |

`InvoiceRecord` adds: `id`, `invoiceNumber`, `clientId`, `clientName`, `amount`, `currency`, `status`, `dueDate`, `paypalInvoiceId`, `payerViewUrl`, `preflightSummary` (counts at send time), `updatedAt`, `updatedVia` (`"app" | "webhook" | "poll"`).

### 10.2 Frontend function to endpoint map (`src/lib/api.ts`)

| Function | Endpoint |
|---|---|
| `listClients()`, `getClient(id)` | API-01, API-02 |
| `extractRequirements(input)` | API-03 |
| `updateRequirement(id, value)` | API-04 |
| `learnFromEmail(input)` | API-05 |
| `draftInvoice(text)` | API-06 |
| `runPreflight(invoice, clientId)` | API-07 |
| `calcPricing(input)` | API-08 |
| `sendInvoice(invoice)` | API-09 |
| `listInvoices(filters)` | API-10 |
| `markPaid(id)` | API-12 |
| `resetDemo()` | API-14 |

Rule: when `VITE_USE_MOCKS=false`, each function calls its endpoint with `fetch` and validates the response with the same Zod schema the mock returns. **Components must not change when the flag flips.**

---

## 11. PayPal integration specification

### 11.1 Choice of API (verified against PayPal docs on 10 Nov 2026)

- Use the **PayPal REST Invoicing API v2** directly with `fetch`.
- **Do not use `@paypal/paypal-server-sdk`** for invoicing: v2.3.0 documents Orders, Payments, Vault, Transaction Search and Subscriptions controllers only; no Invoicing controller.
- No PayPal JS SDK, checkout buttons or Orders API are needed.
- Sandbox base URL: `https://api-m.sandbox.paypal.com`.

| Purpose | Call |
|---|---|
| Access token | `POST /v1/oauth2/token` (client credentials, HTTP Basic with client ID and secret, `grant_type=client_credentials`); cache the token until shortly before expiry |
| Create draft | `POST /v2/invoicing/invoices` (returns 201 with an `href` containing the invoice ID, format `INV2-XXXX-XXXX-XXXX-XXXX`) |
| Send | `POST /v2/invoicing/invoices/{id}/send` with `{ "send_to_recipient": true, "send_to_invoicer": false }` |
| Read | `GET /v2/invoicing/invoices/{id}` |
| Record payment (sandbox demo) | `POST /v2/invoicing/invoices/{id}/payments` |
| Verify webhook | `POST /v1/notifications/verify-webhook-signature` |

### 11.2 Setup checklist (manual, owner: Person A)

1. developer.paypal.com: Apps & Credentials, **Sandbox**, create a REST app; note Client ID and Secret.
2. Sandbox Accounts: one **Business** (invoicer) and one **Personal** (payer). Use the Personal account's email as the recipient in all demo invoices (not a real email).
3. After the app is deployed, register the webhook URL `https://<APP_BASE_URL>/api/webhooks/paypal`, subscribe to `INVOICING.INVOICE.PAID` and `INVOICING.INVOICE.SENT` (optionally `CANCELLED`, `REFUNDED`, ignored by the app), and copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID`.

### 11.3 Create-and-send flow (API-09)

1. Validate input with Zod; load client and requirements.
2. **Re-run pre-flight on the server.** If any blocker, return `422 BLOCKERS_PRESENT`.
3. Insert the invoice row with `status = draft` (guard against double submit; see 14.2).
4. Get PayPal token.
5. `POST /v2/invoicing/invoices` with this mapping (verify field names against the reference while implementing):

| PayPal field | Source |
|---|---|
| `detail.currency_code` | `invoice.currency` |
| `detail.reference` | `invoice.poReference` (**documented as "reference data, includes a PO number", max 120 chars**) |
| `detail.invoice_number` | generated `INV-2026-NNNN` (max 25 chars; or let PayPal auto-increment) |
| `detail.invoice_date` | `invoice.invoiceDate` |
| `detail.payment_term` | `term_type` (e.g. `NET_30`) **or** `due_date`, not both |
| `detail.note` | short note (optional) |
| `invoicer.email_address` / name | sandbox Business account |
| `primary_recipients[0].billing_info.name` / `email_address` | `billTo` and `sendTo` |
| `items[]` | `name`, `quantity`, `unit_amount { currency_code, value }` |

6. `POST .../send` with `send_to_recipient: true`.
7. `GET` the invoice; read `detail.metadata.recipient_view_url` (payer view hosted on paypal.com) and `status`.
8. Update the row: `paypal_invoice_id`, `payer_view_url`, `status = sent`, `updated_via = "app"`, store the pre-flight summary.
9. Return the `InvoiceRecord`.

On any PayPal error: keep the row as `draft`, store the PayPal `debug_id`, return `PAYPAL_ERROR` with details. Never leave a "sent" row without a PayPal invoice ID.

### 11.4 Webhook handling (API-13)

1. Read the **raw body**. Respond fast (`200`) after verification and persistence; do heavy work after.
2. Verify with `POST /v1/notifications/verify-webhook-signature`, passing headers `PAYPAL-AUTH-ALGO` (`auth_algo`), `PAYPAL-CERT-URL` (`cert_url`), `PAYPAL-TRANSMISSION-ID` (`transmission_id`), `PAYPAL-TRANSMISSION-SIG` (`transmission_sig`), `PAYPAL-TRANSMISSION-TIME` (`transmission_time`), the configured `webhook_id`, and the parsed event as `webhook_event`. Proceed only if `verification_status === "SUCCESS"`; otherwise return `400` and log.
3. **Idempotency:** insert into `webhook_events` with unique `event_id` (the event's top-level `id`). If it already exists, return `200` and do nothing.
4. Resolve the invoice via `resource.id` (PayPal invoice ID) to a row by `paypal_invoice_id`.
5. Apply: `INVOICING.INVOICE.PAID` sets `paid`; `INVOICING.INVOICE.SENT` ensures `sent`; unknown events are stored and ignored.
6. Set `updated_via = "webhook"`, `updated_at = now()`.

Event payload fields relied on (documented): `id`, `create_time`, `event_type`, `resource.id`, `resource.status`, `resource.invoice_number`, `resource.amount`, `links[]`. The `resource` shape for events other than PAID is not documented on the webhooks page; confirm against the API reference before relying on it.

### 11.5 Mark paid (API-12)

`POST /v2/invoicing/invoices/{id}/payments` with a payment detail body (method, date, amount equal to the invoice total, optional note). Then `GET` the invoice and update the row; if the PAID webhook also arrives it is deduplicated by event ID and is a no-op. **Verify during implementation** the exact `payment_detail` fields and whether recording a payment fires `INVOICING.INVOICE.PAID` in Sandbox; the endpoint's own description says that if no payment is due the invoice is marked as PAID.

### 11.6 Polling fallback (FR-10)

For non-paid rows older than a few seconds, `GET /api/invoices?refresh=true` calls `GET /v2/invoicing/invoices/{id}` per row (limit concurrency, cap at ~20 rows) and updates status with `updated_via = "poll"`.

### 11.7 Rules for PayPal usage

- Every PayPal call is server-side only. Log PayPal `debug_id` on failures.
- Use `PAYPAL_ENV=sandbox`; guard code against `live` base URL in this project.
- Respect limits: recipient email can only be changed a limited number of times per 72 hours (not used here).
- Do not use the PayPal logo or branding in the UI.

---

## 12. Net-Landing Pricer specification (FR-05)

**Implementation:** pure, unit-tested TypeScript module (`pricer.ts`), config in `pricing-config.ts`. The API only wraps it. Backend and frontend share the module.

**Inputs:** `targetNet` (decimal string), `currency`, `fxApplies` (boolean), optional rate overrides `{ feeRate, fixedFee, fxSpread }`.

**Reference model** (reconcile with the existing function and its tests; the repo code is the source of truth for current behaviour, and any change must keep tests green):

```
totalRate = feeRate + (fxApplies ? fxSpread : 0)
gross     = (targetNet + fixedFee) / (1 - totalRate)        // amount to invoice
fee       = gross * feeRate + fixedFee                      // PayPal fee
fxCost    = fxApplies ? gross * fxSpread : 0                // shown on a SEPARATE line
net       = gross - fee - fxCost                            // equals targetNet
effective = (gross - targetNet) / gross                     // effective cost %
```

Round money to 2 decimals using decimal-safe arithmetic (or integer minor units); round only at the end.

**Placeholder rates (not real PayPal prices; must be replaced after checking PayPal's current pricing for the relevant country):** `feeRate = 0.044`, `fixedFee = 0.30`, `fxSpread = 0.03`.

**Worked examples** with the placeholders:

| Target net | FX | Gross (invoice) | Fee | FX cost | Effective cost |
|---|---|---|---|---|---|
| 1000.00 | no | 1046.34 | 46.34 | 0.00 | 4.43% |
| 1000.00 | yes | 1080.24 | 47.83 | 32.41 | 7.43% |

**Required tests:** zero fixed fee; FX on and off; rounding at the cent; very small and very large amounts; rates overridden; net always reconstructs to the target within one cent.

The UI note "Rates are placeholders" must remain visible until real rates are configured.

---

## 13. AI specification

### 13.1 Principles

- AI **reads, extracts, drafts, explains**. AI does **not** compute money, does not decide the send gate, and does not call PayPal.
- All prompts run server-side. The LLM key never reaches the browser.
- Structured output with a JSON schema (provider's structured-output feature if available), then **Zod validation**, **one retry** on failure, then a typed error.
- Any model works; model ID comes from `LLM_MODEL`. For PDFs, either send the PDF to a model that accepts documents, or extract text server-side first. **Prefer extracting text** so evidence quotes can be verified.

### 13.2 Requirements extraction (FR-01, FR-09)

**Input:** plain text of the client's AP guide, onboarding email, or rejection email.

**Output schema (Zod, indicative):**

```ts
const ExtractionSchema = z.object({
  requirements: z.array(z.object({
    key: z.enum(["po_required","legal_entity","tax_id_required","ap_email",
                 "accepted_currencies","payment_terms","one_invoice_per_file","other"]),
    label: z.string().max(80),
    value: z.union([z.string(), z.array(z.string()), z.boolean()]),
    evidence: z.string().min(8),          // exact quote, copied verbatim
    confidence: z.enum(["high","medium","low"])
  }))
});
```

**Prompt rules** (system): extract only rules explicitly stated; do not infer; copy `evidence` verbatim from the text; if a rule is not stated, omit it; output nothing but the schema.

**Server-side verification (mandatory, NFR-04):** normalise whitespace and case; check each `evidence` string occurs in the source text. If not found, set `confidence = "low"`, flag `evidence_unverified`, or drop the item. Persist `source_text_hash` with the document.

**Demo requirement:** all three demo clients must extract successfully from fixtures stored in the repo (e.g. `fixtures/ap-docs/acme.txt`, `northwind.txt`, `globex.pdf` plus its extracted text). Create these fixtures; they are fake documents.

### 13.3 Draft from one line (FR-03)

Deterministic parser first (`parse-draft.ts`); optional LLM fallback with schema `{ clientName, amount, currency, description }`. Matching to a known client is done in code (case-insensitive, fuzzy to the nearest client above a threshold).

### 13.4 Soft warnings and explanations (PF-06)

Optional single LLM call: given the description and the client's stated rules, return at most two short *warnings* (never blockers) and a suggested improved description. Failure or timeout must silently degrade to the code-only result.

### 13.5 Guardrails

No invented quotes, no money values from the LLM, request size caps, 30 s timeout, log token usage, and do not log full documents in production.

---

## 14. Database specification (Supabase Postgres + Storage)

### 14.1 Principles

Single-tenant demo (no auth, no user table). All access goes through the server with the service key; **RLS is not relied on**; no table is exposed to the browser directly. Money stored as `numeric(12,2)`. IDs are UUIDs. Timestamps are `timestamptz`.

### 14.2 Schema (DDL, indicative)

```sql
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_entity text,
  ap_email text,
  created_at timestamptz not null default now()
);

create table client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null check (kind in ('pdf','text','email')),
  storage_path text,                 -- Supabase Storage path for PDFs
  source_text text not null,         -- extracted/pasted text used for evidence checks
  source_text_hash text not null,
  created_at timestamptz not null default now()
);

create table requirements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  document_id uuid references client_documents(id) on delete set null,
  key text not null,
  label text not null,
  value jsonb not null,
  evidence text not null,
  evidence_verified boolean not null default false,
  confidence text not null check (confidence in ('high','medium','low')),
  source text not null check (source in ('ai','user','email')),
  is_new boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on requirements (client_id);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  client_id uuid references clients(id),
  bill_to text not null,
  send_to text not null,
  currency text not null check (currency in ('USD','EUR')),
  payment_terms text not null,
  po_reference text,
  tax_id text,
  invoice_date date not null,
  due_date date not null,
  total numeric(12,2) not null,
  status text not null default 'draft' check (status in ('draft','sent','paid')),  -- 'overdue' is derived
  paypal_invoice_id text unique,
  payer_view_url text,
  preflight_summary jsonb,           -- {blockers, warnings, passed, issues[]} at send time
  updated_via text check (updated_via in ('app','webhook','poll')),
  paypal_debug_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on invoices (status);
create index on invoices (client_id);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  position int not null,
  description text not null,
  quantity numeric(10,2) not null,
  unit_price numeric(12,2) not null
);

create table webhook_events (
  event_id text primary key,         -- PayPal event id; guarantees idempotency
  event_type text not null,
  paypal_invoice_id text,
  payload jsonb not null,
  verified boolean not null default false,
  processed_at timestamptz,
  received_at timestamptz not null default now()
);
create index on webhook_events (paypal_invoice_id);
```

Storage bucket `ap-documents` (private) holds uploaded PDFs. No pricing table is needed (rates live in config and request overrides).

### 14.3 Invariants and rules

- **DB-01** A `sent` or `paid` invoice **must** have `paypal_invoice_id` (enforce in code and with a check constraint if convenient).
- **DB-02** Double-submit guard: `POST /api/send` is idempotent per draft; if the row already has `paypal_invoice_id`, return the existing record instead of creating a second PayPal invoice.
- **DB-03** `webhook_events.event_id` unique; processing is skipped for duplicates.
- **DB-04** `overdue` is never stored; computed as `status = 'sent' and due_date < current_date`.
- **DB-05** Re-extracting a document deletes only `source = 'ai'` rows from that document; `source = 'user'` rows are kept.
- **DB-06** `invoice_number` generation is sequential per year (`INV-2026-0001`...) and unique.

### 14.4 Seed data (`seed.sql` or a seed script; also used by `/api/dev/reset`)

| Client | Key requirements (with evidence quotes in the fixtures) |
|---|---|
| **Acme Corporation Ltd** | PO required; legal entity exactly "Acme Corporation Ltd"; USD only; Net 30; AP email `ap@acme.example` |
| **Northwind Studio** | No PO; EUR; VAT ID required; Net 15 |
| **Globex Inc** | One invoice per file; separate AP email; Net 45; PDF vendor guide |

Plus about 7 invoices across Draft, Sent, Paid and Overdue (no Cancelled), mirroring the mock set, with fake PayPal IDs clearly marked as seed data.

---

## 15. Deployment

**Requirement:** the webhook needs a **public HTTPS URL**. Deploy early (today), not at the end.

| Option | Notes |
|---|---|
| **Render web service (preferred for the hackathon)** | Node runtime; supports a public URL; relevant to the Render sponsor prize (criteria unverified). Requires configuring TanStack Start for a Node server build (e.g. Nitro `node-server` preset); **verify** the installed version's deploy docs. |
| Cloudflare Workers | The Lovable template appears set up for it (`wrangler` present). Works for `fetch`-based PayPal and LLM calls, but check Node API limits (PDF parsing, crypto, body size) before choosing. |
| Local dev with tunnel (ngrok / cloudflared) | Acceptable for testing webhooks before deploy. |

Build and start commands, Node version, and the exact adapter config must be taken from the repo during implementation. After deploy: set all server env vars on the host, register the webhook URL in the PayPal dashboard, copy the webhook ID into env, redeploy, and send a test event.

---

## 16. Security and compliance

- The repository is **public**: never commit `.env`, keys, tokens, real emails or real documents. Run a secret scan before every push. Rotate any key that was ever committed.
- Secrets only in server env (`PAYPAL_CLIENT_SECRET`, `LLM_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Never prefix with `VITE_`.
- Validate and size-limit all inputs (PDF max a few MB, text max a few hundred KB, only `application/pdf` or text).
- Webhook endpoint only trusts events that pass signature verification.
- Sandbox only; no real money; use fake client documents.
- CORS: same-origin by default; do not enable wildcard CORS.
- Do not log full document contents, secrets, or PayPal tokens.
- The UI must state "PayPal Sandbox, test mode, no real money moves".

---

## 17. Testing and acceptance

### 17.1 Automated

| Area | Tests |
|---|---|
| `preflight.ts` | Each rule PF-01 to PF-08 (trigger and pass cases); currency change to EUR yields PF-03; warnings never block |
| `pricer.ts` | Cases in section 12 plus rounding; round-trip net equals target |
| Zod schemas | Valid and invalid LLM outputs; evidence verifier (verbatim, whitespace, case) |
| Webhook | Signature failure rejected; duplicate event ignored; PAID updates status (verify endpoint mocked) |
| Send | Blockers produce 422; PayPal failure leaves a draft; double submit returns the same invoice |
| API contract | Responses match Zod schemas used by `api.ts` |

Postman (or similar) collection for PayPal calls, used to confirm field names before coding.

### 17.2 Manual acceptance script (the demo)

1. Open `/` then "Try the demo".
2. `/app/new-invoice` loads with **2 blockers, 1 warning, 3 passes**.
3. Click "Add PO" and "Use legal name": blockers drop, button turns green "Cleared for send".
4. Change currency to EUR: a **third blocker type** appears. Change back.
5. Click Send: real sandbox invoice is created; success card shows a **real PayPal invoice ID**; "Open payer link" opens the PayPal hosted page.
6. `/app/invoices`: row shows **Sent**; sandbox Business dashboard shows it as **Unpaid**.
7. "Mark paid (sandbox)" (or pay from the payer link): within seconds row becomes **Paid**, "Paid via webhook" shown.
8. `/app/clients`: paste text for a client, extract, see rules with evidence quotes (verified).
9. `/app/pricer`: target net 1000 gives the breakdown, change rates, then "Use this amount in a new invoice".
10. No "Remind" or "Cancelled" anywhere; no console errors.

### 17.3 Definition of Done

All P0 requirements pass 17.2 against the **deployed** URL with `VITE_USE_MOCKS=false`; tests green; build passes; no secrets in git; README has setup, env, demo script; 3-minute video recorded; Devpost submission complete.

---

## 18. Implementation plan (backend and database)

Dates assume today is **Tue 10 Nov** and a **12 Nov** deadline (treat as earlier than stated; submit with margin). Owners are suggestions.

| Order | Task | Owner | Done when |
|---|---|---|---|
| 1 | Inspect TanStack Start version: server functions, server routes (for the webhook), env handling, deploy target | A | Decision recorded (19.1) |
| 2 | Create Supabase project, run DDL (14.2), seed (14.4), private storage bucket | A | Tables exist, seed loads |
| 3 | PayPal sandbox app and accounts; token helper; **create + send + get** against sandbox via a script/Postman | A | Real invoice visible as UNPAID in sandbox dashboard |
| 4 | Implement API-09 `/api/send` with server-side pre-flight gate and DB writes | A | Frontend success card shows real ID |
| 5 | Deploy skeleton to the host; set env; register webhook | A | Public URL live |
| 6 | Webhook handler (verify, dedupe, update) and API-12 mark-paid | A | Invoice becomes Paid in the app |
| 7 | LLM extraction API-03 with Zod, evidence verifier, fixtures | B (prompts) + A | 3 demo clients extract; quotes verified |
| 8 | API-01/02/04/07/08/10/11 (CRUD, preflight, pricer, invoices) using shared modules | A | `VITE_USE_MOCKS=false` works across screens |
| 9 | P1: API-05 learn-from-email, API-10 refresh polling, API-14 reset | A/B | Optional |
| 10 | **Feature freeze (tonight 10 Nov)**, fix bugs only | both | |
| 11 | Polish, README, demo video, Devpost text and screenshots (11 Nov) | both | |
| 12 | Submit (12 Nov, early) | both | |

**Cut order if time runs out:** FR-09 learn-from-email, then FR-10 polling and FR-12 reset, then the AI soft warning (PF-06 stays code-only), then persistence of edits. **Never cut:** real PayPal send, server-side send gate, evidence-verified extraction, webhook (or polling) status update.

**Fallbacks:** webhook problems give polling (FR-10) plus "Mark paid"; LLM problems give cached extraction results for the three demo documents (mark as cached in code comments, not in the UI claims); PayPal outage gives a prepared screen recording of the successful flow.

---

## 19. Risks, assumptions and open questions

### 19.1 To verify during implementation (not yet confirmed)

1. TanStack Start (installed version): server function and server route syntax; reading env on the server; how to expose a raw-body POST route for the webhook.
2. Deploy: Render (Node preset) versus Cloudflare Workers constraints; public webhook reachability.
3. PayPal `POST /payments` body fields and whether it triggers the PAID webhook in Sandbox.
4. Full list of PayPal invoice statuses for `mapPayPalStatus()`.
5. Whether PayPal's `PayPal-Request-Id` idempotency header is supported on invoice creation (otherwise rely on DB-02).
6. Sandbox email delivery and the payer-view flow.
7. Whether PayPal Invoicing is available for the chosen sandbox business country/currencies (India-based accounts may have constraints).
8. Current PayPal fee and FX rates for the target country (replace the placeholders).
9. LLM provider limits, credits and PDF handling.
10. Devpost rules: judging criteria, video length, repo requirements, deadline timezone, team size, certificate. Sponsor prize criteria (AG Grid, Render, APIMatic) are unverified.
11. AG Grid license terms for the version used.

### 19.2 Risks

| Risk | Mitigation |
|---|---|
| PayPal integration takes longer than planned | Do step 3 first; Postman before code; polling and mark-paid fallbacks |
| Webhook cannot reach the app | Deploy early; tunnel for local tests; polling |
| LLM hallucinated rules | Evidence verification, "low confidence" labelling, user edit |
| Frontend and backend schemas drift | One Zod schema file, contract tests |
| Secrets leak in a public repo | `.gitignore`, pre-push secret scan, server-only env names |
| Scope creep | Section 2.2 non-goals; cut order in section 18 |

### 19.3 Assumptions

Single demo user; fake clients and documents; Sandbox only; USD and EUR only; a Person-A/Person-B split as described; the existing frontend behaviour listed in section 7 is accurate as of the last recordings reviewed (9 and 10 Nov).

---

## 20. Appendix: demo and submission checklist

**Demo script (3 minutes).** 0:00 landing and problem (15 s) | 0:15 Clients: paste or upload AP guide, rules with quotes (30 s) | 0:45 New invoice: one line, 2 blockers + warning, fix, third blocker via EUR, back (60 s) | 1:45 Send via PayPal, success card, PayPal hosted page (30 s) | 2:15 Invoices: Paid via webhook (20 s) | 2:35 Pricer (15 s) | 2:50 close: "What's next" (reminders, dispute evidence pack, more currencies) (10 s).

**Devpost checklist.** Project name and tagline | description (problem, solution, how PayPal and AI are used, challenges, what's next) | demo video link | public repo link | deployed URL | screenshots (landing, pre-flight, Invoices) | built-with list (TanStack Start, React, Tailwind, shadcn/ui, AG Grid, Zod, PayPal Invoicing REST API and webhooks, LLM API, Supabase, host) | Sandbox disclaimer | team members | submit **before** the stated deadline, ideally the evening before.

**Claim hygiene.** Say "we found no freelancer-level tool that checks invoices against the client's AP rules before sending", not "first in the world". Do not use real client names, real invoices, fake testimonials or invented statistics.
