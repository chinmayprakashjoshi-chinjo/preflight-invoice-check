import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASE_URL = "http://localhost:8000";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const db = createClient(supabaseUrl, supabaseKey);

interface CheckResult {
  num: number;
  name: string;
  passed: boolean;
  actual: any;
  error?: string;
}

const results: CheckResult[] = [];

async function check1(): Promise<CheckResult> {
  const name = "1. POST /api/send for Acme with NO PO and bill-to 'Acme Corp' (must return 422 BLOCKERS_PRESENT, no PayPal invoice)";
  try {
    const payload = {
      clientName: "Acme Corp",
      sendTo: "billing@acme.example.com",
      currency: "USD",
      paymentTerms: "Net 30",
      poNumber: "",
      invoiceDate: new Date().toISOString().slice(0, 10),
      lineItems: [{ description: "Dev work", quantity: 1, unitPrice: 100 }],
    };

    const res = await fetch(`${BASE_URL}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as any;
    const passed =
      res.status === 422 &&
      data?.error?.code === "BLOCKERS_PRESENT" &&
      Array.isArray(data?.error?.details?.blockers) &&
      data.error.details.blockers.length > 0 &&
      !data.paypalInvoiceId;

    return {
      num: 1,
      name,
      passed,
      actual: { status: res.status, body: data },
    };
  } catch (err: any) {
    return { num: 1, name, passed: false, actual: null, error: err.message || String(err) };
  }
}

async function check2(): Promise<CheckResult> {
  const name = "2. POST /api/send twice with same idempotencyKey (must return same invoice, exactly one PayPal invoice)";
  try {
    const idempotencyKey = `idem-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const validPayload = {
      clientName: "Acme Corporation Ltd",
      sendTo: "ap@acme.example",
      currency: "USD",
      paymentTerms: "Net 30",
      poNumber: "PO-2026-04418",
      invoiceDate: new Date().toISOString().slice(0, 10),
      lineItems: [{ description: "Consulting Milestone Delivery", quantity: 1, unitPrice: 150 }],
      idempotencyKey,
    };

    // First call
    const res1 = await fetch(`${BASE_URL}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(validPayload),
    });
    const data1 = (await res1.json()) as any;

    // Second call with same idempotency key
    const res2 = await fetch(`${BASE_URL}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(validPayload),
    });
    const data2 = (await res2.json()) as any;

    const sameStatus = res1.status === 201 && (res2.status === 200 || res2.status === 201);
    const sameNumber = data1?.number && data1.number === data2?.number;
    const samePayPalId = data1?.paypalInvoiceId && data1.paypalInvoiceId === data2?.paypalInvoiceId;
    const passed = Boolean(sameStatus && sameNumber && samePayPalId);

    return {
      num: 2,
      name,
      passed,
      actual: {
        call1: { status: res1.status, number: data1?.number, paypalInvoiceId: data1?.paypalInvoiceId },
        call2: { status: res2.status, number: data2?.number, paypalInvoiceId: data2?.paypalInvoiceId },
      },
    };
  } catch (err: any) {
    return { num: 2, name, passed: false, actual: null, error: err.message || String(err) };
  }
}

async function check3(): Promise<CheckResult> {
  const name = "3. POST /api/requirements with pasted text (EUR, PO not required, Net 45 verbatim evidence; 502 EXTRACTION_FAILED on error)";
  try {
    const text = "All invoices must be in EUR. We do not require a PO number. Payment terms are strictly Net 45.";
    const res = await fetch(`${BASE_URL}/api/requirements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "acme", text }),
    });

    const data = (await res.json()) as any;
    const reqs = data?.requirements;
    const meta = reqs?.meta || {};

    const clean = (s: string) => (s || "").replace(/["'\s]+/g, " ").trim().toLowerCase();
    const cleanSource = clean(text);

    const hasEur = Array.isArray(reqs?.allowedCurrencies) && reqs.allowedCurrencies.includes("EUR");
    const poNotReq = reqs?.poRequired === false;
    const hasNet45 = reqs?.paymentTerms === "Net 45";

    const poEvidenceValid = meta.poRequired?.evidence ? cleanSource.includes(clean(meta.poRequired.evidence)) : false;
    const currEvidenceValid = meta.allowedCurrencies?.evidence ? cleanSource.includes(clean(meta.allowedCurrencies.evidence)) : false;
    const termsEvidenceValid = meta.paymentTerms?.evidence ? cleanSource.includes(clean(meta.paymentTerms.evidence)) : false;

    const isSuccess = Boolean(
      res.status === 200 &&
      hasEur &&
      poNotReq &&
      hasNet45 &&
      poEvidenceValid &&
      currEvidenceValid &&
      termsEvidenceValid
    );

    const isStrictError = Boolean(
      res.status === 502 &&
      data?.error?.code === "EXTRACTION_FAILED" &&
      !data?.requirements
    );

    const passed = Boolean(isSuccess || isStrictError);

    return {
      num: 3,
      name,
      passed,
      actual: {
        status: res.status,
        allowedCurrencies: reqs?.allowedCurrencies,
        poRequired: reqs?.poRequired,
        paymentTerms: reqs?.paymentTerms,
        evidence: {
          po: meta.poRequired?.evidence,
          currencies: meta.allowedCurrencies?.evidence,
          terms: meta.paymentTerms?.evidence,
        },
      },
    };
  } catch (err: any) {
    return { num: 3, name, passed: false, actual: null, error: err.message || String(err) };
  }
}

async function check4(): Promise<CheckResult> {
  const name = "4. GET /api/invoices: no row has status 'overdue' stored in database; overdue only derived";
  try {
    // 4A: Check raw rows in database directly
    const { data: rawRows, error: dbErr } = await db.from("invoices").select("id, invoice_number, status, due_date");
    if (dbErr) throw dbErr;

    const storedOverdue = (rawRows || []).filter((r: any) => r.status === "overdue");
    const noStoredOverdue = storedOverdue.length === 0;

    // 4B: Check API response
    const res = await fetch(`${BASE_URL}/api/invoices`);
    const apiInvoices = (await res.json()) as any;
    const derivedOverdue = Array.isArray(apiInvoices)
      ? apiInvoices.filter((i: any) => i.status === "overdue")
      : [];

    const passed = noStoredOverdue && derivedOverdue.length > 0;

    return {
      num: 4,
      name,
      passed,
      actual: {
        rawDbStoredOverdueCount: storedOverdue.length,
        apiDerivedOverdueCount: derivedOverdue.length,
        derivedExamples: derivedOverdue.map((i: any) => ({ number: i.number, dueDate: i.dueDate, status: i.status })),
      },
    };
  } catch (err: any) {
    return { num: 4, name, passed: false, actual: null, error: err.message || String(err) };
  }
}

async function check5(): Promise<CheckResult> {
  const name = "5. Run npm test and npx tsc --noEmit";
  try {
    console.log("   Running tsc --noEmit in backend...");
    const tscBackend = execSync("npm run typecheck --prefix backend", { encoding: "utf-8" });

    console.log("   Running vitest in frontend...");
    const testFrontend = execSync("npm test --prefix frontend -- --run", { encoding: "utf-8" });

    const passed = true;
    return {
      num: 5,
      name,
      passed,
      actual: {
        tscBackendOutput: tscBackend.trim().slice(0, 300),
        testFrontendOutput: testFrontend.trim().slice(-400),
      },
    };
  } catch (err: any) {
    return {
      num: 5,
      name,
      passed: false,
      actual: null,
      error: err.stdout || err.stderr || err.message,
    };
  }
}

async function main() {
  console.log("=================================================");
  console.log("   PREFLIGHT VERIFICATION RUNNER");
  console.log("=================================================\n");

  try {
    await fetch(`${BASE_URL}/api/dev/reset`, { method: "POST" });
  } catch {}

  const c1 = await check1();
  results.push(c1);
  printResult(c1);

  const c2 = await check2();
  results.push(c2);
  printResult(c2);

  const c3 = await check3();
  results.push(c3);
  printResult(c3);

  const c4 = await check4();
  results.push(c4);
  printResult(c4);

  const c5 = await check5();
  results.push(c5);
  printResult(c5);

  console.log("\n=================================================");
  const allPassed = results.every((r) => r.passed);
  console.log(allPassed ? "🎉 ALL CHECKS PASSED!" : "⚠️ SOME CHECKS FAILED - FIXES REQUIRED");
  console.log("=================================================");
}

function printResult(r: CheckResult) {
  const badge = r.passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${badge}: ${r.name}`);
  if (r.error) {
    console.log("   Error:", r.error);
  } else {
    console.log("   Actual:", JSON.stringify(r.actual, null, 2).split("\n").map(l => "   " + l).join("\n"));
  }
  console.log();
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
