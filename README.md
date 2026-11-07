# PreFlight Invoice Check

You are building the FRONTEND ONLY of "PreFlight", a web app for freelancers. It checks an invoice against the client's accounts-payable (AP) requirements BEFORE the invoice is sent, then sends it via PayPal. Use mock data now; a separate backend will be connected later.

STACK
React + TypeScript + Vite, Tailwind CSS, shadcn/ui, lucide-react icons, React Router, Zod. Use AG Grid Community (ag-grid-react) for the Invoices table. Do NOT add Supabase, auth, login, or any database. No backend calls to real services.

ATTACHED SCREENSHOTS (layout reference only)
- Screenshot 1 (Create Invoice): layout reference for the "New invoice" screen: form on the left, a large panel on the right, action buttons top-right.
- Screenshot 2 (dashboard): layout reference for the "Invoices" screen: sidebar, 4 KPI cards, table with status pills.
IGNORE both screenshots' colours, fonts, logos, names and branding. Use only the design system below. Do not copy their content.

DESIGN SYSTEM (light theme only, no dark mode)
- Define everything as CSS variables / Tailwind tokens. Never hardcode hex values inside components.
- Background #F8FAFC, surface/cards #FFFFFF, border #E2E8F0, text #0F172A, muted text #64748B.
- Primary indigo #4338CA (hover #3730A3, tint #EEF2FF). Money/amount accent teal #0D9488.
- Status colours (text on tint): Blocker #DC2626 on #FEF2F2; Warning #D97706 on #FFFBEB; Pass #16A34A on #F0FDF4; Info #0284C7 on #F0F9FF.
- Invoice status chips: Draft = grey; Sent = indigo; Paid = green; Overdue = amber; Cancelled = grey with line-through text.
- Font: Inter. Money and numbers use tabular-nums. Radius 8px (cards 12px). No gradients, no shadows heavier than a subtle 1px border look, no emoji.
- Colour is NEVER the only signal: every status shows an icon AND a text label.
- Text contrast at least 4.5:1. Use real <button>, <label>, <input> elements, visible focus rings, aria-labels on icon-only buttons.
- Do NOT use the PayPal logo or PayPal blue anywhere. Use a small text badge "PayPal Sandbox" (info colour) in the sidebar footer.
- Responsive: works at 1440px (primary) and stacks to one column below 900px.

APP SHELL
Left sidebar (240px): logo "PreFlight" (indigo rounded square with a check icon), nav items: Clients, New invoice, Pricer, Invoices. Active item has indigo tint background. Sidebar footer: "PayPal Sandbox" badge. Default route redirects to /new-invoice.

ROUTES
/clients, /new-invoice, /pricer, /invoices

SCREEN 1: NEW INVOICE (/new-invoice) - the hero screen, make it the most polished
Header: title "New invoice", subtitle "Describe the invoice in one line. PreFlight checks it against the client's AP rules before it goes out." Top-right: secondary "Preview" button (opens a dialog with a clean invoice preview) and primary "Send via PayPal" button.
Below the header: a card with one text input (default value "Invoice Acme Corp $1,200 for site redesign") and a "Generate draft" button. On click, show a 600ms loading state, then fill the form from the text (simple parsing of client name, amount, description is enough; fall back to the Acme example).
Two columns:
- LEFT "Draft invoice" form card (editable, like screenshot 1): Client (select from mock clients, but the draft's client field is free text so mismatches can happen), Currency (USD/EUR select), Payment terms (Net 15/30/45), PO reference (text), VAT ID (text), invoice date, due date (auto from terms), line items table (description, qty, unit price, amount) with "Add item", total row. All values editable.
- RIGHT "Pre-flight check" panel: header with count chips ("2 blockers", "1 warning", "3 passed"). Then issue cards, each with: icon in a tinted square, severity badge (Blocker/Warning), title, one-line explanation, an "evidence" box styled as Info colour reading "From <client>'s AP doc:" + quoted text, and a fix button ("Add PO", "Use legal name", "Improve"). Clicking a fix button applies the fix to the form and the check list updates live. Passed checks appear as a compact list with green check icons at the bottom.
- Bottom of the right panel: the "Send via PayPal" button state area. While blockers exist: button DISABLED with lock icon and text "Resolve N blockers before sending". When zero blockers: green button "Cleared for send" with check icon; clicking it shows a loading state then a success toast "Invoice sent in PayPal Sandbox" and adds the invoice to mock Invoices as Sent. Warnings alone do NOT block sending (show a small note "1 warning, you can still send").
- Pre-flight must run LIVE whenever the form changes (debounced), using a pure function in src/lib/preflight.ts: preflight(invoice, clientRequirements) => Issue[]. Rules: PO required and empty = Blocker; client name does not exactly match required legal entity = Blocker; currency not in allowed list = Blocker; VAT ID required and empty = Blocker; payment terms differ from client's terms = Warning; description under 3 words or generic ("services", "work", "design") = Warning; invoice must go to client's AP email (pass/fail check). Each Issue: { id, severity: 'blocker'|'warning'|'pass', title, message, evidence, fixLabel, fixField, fixValue }.
- Add a visible empty state if no client is chosen, and an error state example for "could not read the AP document".

SCREEN 2: CLIENTS (/clients)
Left list of 3 clients, right detail panel. Detail shows "AP requirements" as a checklist table: Requirement, Value, Evidence (quote from the doc), Confidence badge. Include an upload dropzone ("Drop the client's AP / vendor guide PDF") and an "Extract requirements" button with a 1.5s mock loading state, then reveal the extracted list. Each requirement has an Edit action so the user can correct it.
Mock clients:
1. Acme Corporation Ltd: PO number required; exact legal entity "Acme Corporation Ltd"; USD only; Net 30; AP email ap@acme.example. Evidence quotes, e.g. "All invoices must reference a valid PO number."
2. Northwind Studio: no PO; EUR; VAT ID required; Net 15.
3. Globex Inc: one invoice per file; separate AP email; Net 45; source is a PDF vendor guide.

SCREEN 3: PRICER (/pricer) "Net-Landing Pricer"
Inputs: Target net amount (what I want to receive), Currency, Client currency, toggle "Client pays in a different currency". Outputs in a clean card: Invoice amount to send (large, teal, tabular), PayPal fee, FX spread (shown as a SEPARATE line), Effective cost % , and a one-line explanation. Math lives in a pure, unit-testable function src/lib/pricer.ts using a config file src/config/pricing-config.ts: gross = (net + fixedFee) / (1 - feeRate); effective cost = (gross - net) / gross. Use clearly labelled PLACEHOLDER rates (feeRate, fixedFee, fxSpread) in the config and show a small note "Rates are placeholders; configure in pricing-config". Add a "Use this amount in a new invoice" button that navigates to /new-invoice with the amount prefilled.

SCREEN 4: INVOICES (/invoices)
Four KPI cards: Draft, Sent (unpaid), Paid, Overdue, each with a count and amount. Below, an AG Grid table with columns: Invoice #, Client, Amount, Currency, Status (chip with icon+text), Due date, Pre-flight result (e.g. "Cleared" or "1 warning"), Actions. Include filters (status select, search box). Row actions: "Remind" (Sent/Overdue only), "Mark paid (sandbox)" (Sent/Overdue only; updates status to Paid and shows a toast). Provide 8 mock rows covering all statuses, including one Cancelled. Style AG Grid to match the tokens (light, 8px radius, no heavy borders).

ARCHITECTURE RULES
- Create src/lib/api.ts with typed async functions that currently return mock data after a small delay: getClients, extractRequirements, runPreflight, calcPricing, sendInvoice, getInvoices, markPaid. Read the base URL from import.meta.env.VITE_API_BASE_URL so the real backend can be swapped in later without touching components.
- Types and Zod schemas in src/lib/types.ts. Mock data in src/mocks/.
- Reusable components: StatusChip, SeverityBadge, IssueCard, KpiCard, MoneyText (tabular-nums), EmptyState.
- Handle loading, empty and error states on every screen.
- Keep code clean and componentised so I can edit it with another tool afterwards.

DO NOT
- No auth, no Supabase, no real PayPal calls, no charts, no dark mode, no animations beyond subtle transitions, no emoji, no lorem ipsum (use realistic copy), no PayPal branding.

Build all four screens, starting with New invoice. Make New invoice the best-looking and the most interactive.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7a3bf700-8b41-4b75-9b17-5510c78dbdaa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
