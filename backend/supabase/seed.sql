-- PreFlight Seed Data (Supabase Postgres)
-- Matches PRD Section 14.4 & Demo Fixtures
-- Idempotent: deletes existing data before re-inserting in dependency order

begin;

-- 1. Clean existing records in reverse dependency order
delete from webhook_events;
delete from invoice_items;
delete from invoices;
delete from requirements;
delete from client_documents;
delete from clients;

-- 2. Insert Clients
-- Using fixed UUIDs for deterministic seeding and references
insert into clients (id, name, legal_entity, ap_email, created_at) values
  ('a0000000-0000-0000-0000-000000000001', 'Acme Corporation Ltd', 'Acme Corporation Ltd', 'ap@acme.example', now()),
  ('a0000000-0000-0000-0000-000000000002', 'Northwind Studio', null, 'finance@northwind.example', now()),
  ('a0000000-0000-0000-0000-000000000003', 'Globex Inc', 'Globex Inc', 'payables@globex.example', now());

-- 3. Insert Client Documents with realistic fake AP guides
-- Every requirement evidence quote appears verbatim in the corresponding source_text
insert into client_documents (id, client_id, kind, storage_path, source_text, source_text_hash, created_at) values
  (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'text',
    null,
    E'ACME CORPORATION LTD - ACCOUNTS PAYABLE & SUPPLIER INVOICING POLICY\nRevision: 2026.1 | Effective: January 1, 2026\n\n1. Invoicing Entity & Contact Information\nInvoices must be addressed to our legal entity, "Acme Corporation Ltd", exactly as registered.\nSubmit invoices as PDF to ap@acme.example. Invoices sent elsewhere are not processed.\n\n2. Purchase Order Requirements\nAll invoices must reference a valid PO number. Invoices without a PO will be returned unpaid.\nEnsure your line items correspond directly to the approved deliverable descriptions.\n\n3. Currency & Payment Terms\nWe process supplier payments in US Dollars (USD) only.\nStandard payment terms are Net 30 from the date of a compliant invoice.\nA VAT or tax ID is not required for US-based suppliers.\nMultiple invoices may be attached to a single email.',
    'md5_acme_policy_2026',
    now()
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'text',
    null,
    E'NORTHWIND STUDIO FREELANCER ONBOARDING GUIDE\nWelcome to the Northwind creative network. Please review our invoicing standards:\n\n1. Purchase Orders\nWe do not issue purchase orders for freelance engagements.\nYour project manager''s written scope approval serves as billing authorization.\n\n2. Tax Identification & Currency\nPlease invoice in euro (EUR). We cannot pay invoices in other currencies.\nYour VAT identification number must appear on every invoice.\n\n3. Payment Schedule\nWe pay supplier invoices within 15 days of receipt.\nPlease send invoices in PDF format to finance@northwind.example.',
    'md5_northwind_onboarding_2026',
    now()
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'pdf',
    null,
    E'GLOBEX INC - GLOBAL VENDOR & ACCOUNTS PAYABLE MANUAL\nSection 4: External Contractor Billing Procedures\n\n1. Entity Address & Transmission\nBill to: "Globex Inc", 1 Cypress Creek Parkway.\nInvoices must go to payables@globex.example, not to your project contact.\n\n2. Document Formatting\nSubmit one invoice per PDF file. Combined files will be rejected.\nA PO is only required for engagements above $25,000.\n\n3. Settlement & Currencies\nInvoices may be issued in USD or EUR.\nPayment terms for all vendors are Net 45.\nRemittance confirmations are issued automatically upon bank clearance.',
    'md5_globex_vendor_guide_2026',
    now()
  );

-- 4. Insert Requirements
-- Verbatim evidence quotes, evidence_verified = true, source = 'ai'
insert into requirements (client_id, document_id, key, label, value, evidence, evidence_verified, confidence, source, is_new) values
  -- Acme Requirements
  (
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'poRequired',
    'Purchase Order Reference',
    'true'::jsonb,
    'All invoices must reference a valid PO number. Invoices without a PO will be returned unpaid.',
    true,
    'high',
    'ai',
    false
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'legalName',
    'Legal Entity Name',
    '"Acme Corporation Ltd"'::jsonb,
    'Invoices must be addressed to our legal entity, "Acme Corporation Ltd", exactly as registered.',
    true,
    'high',
    'ai',
    false
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'allowedCurrencies',
    'Allowed Currencies',
    '["USD"]'::jsonb,
    'We process supplier payments in US Dollars (USD) only.',
    true,
    'high',
    'ai',
    false
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'paymentTerms',
    'Payment Terms',
    '"Net 30"'::jsonb,
    'Standard payment terms are Net 30 from the date of a compliant invoice.',
    true,
    'high',
    'ai',
    false
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'apEmail',
    'AP Submission Email',
    '"ap@acme.example"'::jsonb,
    'Submit invoices as PDF to ap@acme.example. Invoices sent elsewhere are not processed.',
    true,
    'high',
    'ai',
    false
  ),

  -- Northwind Requirements
  (
    'a0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000002',
    'poRequired',
    'Purchase Order Reference',
    'false'::jsonb,
    'We do not issue purchase orders for freelance engagements.',
    true,
    'high',
    'ai',
    false
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000002',
    'allowedCurrencies',
    'Allowed Currencies',
    '["EUR"]'::jsonb,
    'Please invoice in euro (EUR). We cannot pay invoices in other currencies.',
    true,
    'high',
    'ai',
    false
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000002',
    'vatRequired',
    'VAT Identification',
    'true'::jsonb,
    'Your VAT identification number must appear on every invoice.',
    true,
    'high',
    'ai',
    false
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000002',
    'paymentTerms',
    'Payment Terms',
    '"Net 15"'::jsonb,
    'We pay supplier invoices within 15 days of receipt.',
    true,
    'medium',
    'ai',
    false
  ),

  -- Globex Requirements
  (
    'a0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000003',
    'oneInvoicePerFile',
    'Single Invoice per PDF',
    'true'::jsonb,
    'Submit one invoice per PDF file. Combined files will be rejected.',
    true,
    'high',
    'ai',
    false
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000003',
    'apEmail',
    'AP Submission Email',
    '"payables@globex.example"'::jsonb,
    'Invoices must go to payables@globex.example, not to your project contact.',
    true,
    'high',
    'ai',
    false
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000003',
    'paymentTerms',
    'Payment Terms',
    '"Net 45"'::jsonb,
    'Payment terms for all vendors are Net 45.',
    true,
    'high',
    'ai',
    false
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000003',
    'legalName',
    'Legal Entity Name',
    '"Globex Inc"'::jsonb,
    'Bill to: "Globex Inc", 1 Cypress Creek Parkway.',
    true,
    'medium',
    'ai',
    false
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000003',
    'allowedCurrencies',
    'Allowed Currencies',
    '["USD", "EUR"]'::jsonb,
    'Invoices may be issued in USD or EUR.',
    true,
    'high',
    'ai',
    false
  );

-- 5. Insert 7 Invoices across Paid, Overdue, Sent, and Draft
-- DB-01: 'sent' and 'paid' rows have non-null fake paypal_invoice_id
-- DB-04: 'overdue' is derived from status = 'sent' and due_date < current_date
insert into invoices (
  id,
  invoice_number,
  client_id,
  bill_to,
  send_to,
  currency,
  payment_terms,
  po_reference,
  tax_id,
  invoice_date,
  due_date,
  total,
  status,
  paypal_invoice_id,
  payer_view_url,
  preflight_summary,
  updated_via,
  created_at
) values
  -- Invoice 1: Paid (Acme)
  (
    'b0000000-0000-0000-0000-000000000001',
    'INV-2026-0101',
    'a0000000-0000-0000-0000-000000000001',
    'Acme Corporation Ltd',
    'ap@acme.example',
    'USD',
    'Net 30',
    'PO-2026-04418',
    null,
    current_date - 70,
    current_date - 40,
    4800.00,
    'paid',
    'SEED-INV2-0001',
    'https://www.sandbox.paypal.com/invoice/p/#SEED-INV2-0001',
    '{"blockers": 0, "warnings": 0, "passed": 5}'::jsonb,
    'webhook',
    now() - interval '70 days'
  ),

  -- Invoice 2: Paid (Northwind)
  (
    'b0000000-0000-0000-0000-000000000002',
    'INV-2026-0102',
    'a0000000-0000-0000-0000-000000000002',
    'Northwind Studio',
    'finance@northwind.example',
    'EUR',
    'Net 15',
    null,
    'NL859123456B01',
    current_date - 55,
    current_date - 40,
    2150.00,
    'paid',
    'SEED-INV2-0002',
    'https://www.sandbox.paypal.com/invoice/p/#SEED-INV2-0002',
    '{"blockers": 0, "warnings": 1, "passed": 4}'::jsonb,
    'webhook',
    now() - interval '55 days'
  ),

  -- Invoice 3: Overdue (Globex) -> status = 'sent', due_date < current_date
  (
    'b0000000-0000-0000-0000-000000000003',
    'INV-2026-0103',
    'a0000000-0000-0000-0000-000000000003',
    'Globex Inc',
    'payables@globex.example',
    'USD',
    'Net 45',
    null,
    null,
    current_date - 60,
    current_date - 15,
    6400.00,
    'sent',
    'SEED-INV2-0003',
    'https://www.sandbox.paypal.com/invoice/p/#SEED-INV2-0003',
    '{"blockers": 0, "warnings": 1, "passed": 4}'::jsonb,
    'app',
    now() - interval '60 days'
  ),

  -- Invoice 4: Overdue (Northwind) -> status = 'sent', due_date < current_date
  (
    'b0000000-0000-0000-0000-000000000004',
    'INV-2026-0104',
    'a0000000-0000-0000-0000-000000000002',
    'Northwind Studio',
    'finance@northwind.example',
    'EUR',
    'Net 15',
    null,
    'NL859123456B01',
    current_date - 30,
    current_date - 8,
    980.00,
    'sent',
    'SEED-INV2-0004',
    'https://www.sandbox.paypal.com/invoice/p/#SEED-INV2-0004',
    '{"blockers": 0, "warnings": 0, "passed": 5}'::jsonb,
    'app',
    now() - interval '30 days'
  ),

  -- Invoice 5: Sent/Pending (Acme) -> status = 'sent', due_date in future
  (
    'b0000000-0000-0000-0000-000000000005',
    'INV-2026-0105',
    'a0000000-0000-0000-0000-000000000001',
    'Acme Corporation Ltd',
    'ap@acme.example',
    'USD',
    'Net 30',
    'PO-2026-04419',
    null,
    current_date - 9,
    current_date + 21,
    3200.00,
    'sent',
    'SEED-INV2-0005',
    'https://www.sandbox.paypal.com/invoice/p/#SEED-INV2-0005',
    '{"blockers": 0, "warnings": 0, "passed": 5}'::jsonb,
    'app',
    now() - interval '9 days'
  ),

  -- Invoice 6: Sent/Pending (Northwind) -> status = 'sent', due_date in future
  (
    'b0000000-0000-0000-0000-000000000006',
    'INV-2026-0106',
    'a0000000-0000-0000-0000-000000000002',
    'Northwind Studio',
    'finance@northwind.example',
    'EUR',
    'Net 15',
    null,
    'NL859123456B01',
    current_date - 5,
    current_date + 10,
    1425.00,
    'sent',
    'SEED-INV2-0006',
    'https://www.sandbox.paypal.com/invoice/p/#SEED-INV2-0006',
    '{"blockers": 0, "warnings": 1, "passed": 4}'::jsonb,
    'app',
    now() - interval '5 days'
  ),

  -- Invoice 7: Draft (Globex) -> status = 'draft', no PayPal ID yet
  (
    'b0000000-0000-0000-0000-000000000007',
    'INV-2026-0107',
    'a0000000-0000-0000-0000-000000000003',
    'Globex Inc',
    'payables@globex.example',
    'USD',
    'Net 45',
    null,
    null,
    current_date,
    current_date + 45,
    5600.00,
    'draft',
    null,
    null,
    null,
    'app',
    now()
  );

-- 6. Insert Invoice Items for each invoice
insert into invoice_items (invoice_id, position, description, quantity, unit_price) values
  ('b0000000-0000-0000-0000-000000000001', 1, 'Website redesign - Phase 1 milestone', 1.00, 4800.00),
  ('b0000000-0000-0000-0000-000000000002', 1, 'Brand identity sprint & asset kit', 1.00, 2150.00),
  ('b0000000-0000-0000-0000-000000000003', 1, 'Cloud infrastructure audit & recommendations', 1.00, 6400.00),
  ('b0000000-0000-0000-0000-000000000004', 1, 'UI UX Design Review and Usability Heuristics', 1.00, 980.00),
  ('b0000000-0000-0000-0000-000000000005', 1, 'Frontend development sprint 4', 1.00, 3200.00),
  ('b0000000-0000-0000-0000-000000000006', 1, 'Design system tokens and components', 1.00, 1425.00),
  ('b0000000-0000-0000-0000-000000000007', 1, 'Full-stack application prototype delivery', 1.00, 5600.00);

commit;
