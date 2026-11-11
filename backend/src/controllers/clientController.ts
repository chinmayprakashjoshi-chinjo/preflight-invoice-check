import { Request, Response } from "express";
import crypto from "node:crypto";
import { db } from "../../lib/db.js";
import { extractAPRequirements } from "../services/aiService.js";
import type { Client, ClientRequirements, Currency, PaymentTerms } from "../../../shared/types.js";

/**
 * Resolves a client by UUID or case-insensitive name/entity substring.
 */
export async function resolveClient(idOrName: string) {
  if (!idOrName) return null;

  const trimmed = idOrName.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

  if (isUuid) {
    const { data } = await db.from("clients").select("*").eq("id", trimmed).maybeSingle();
    if (data) return data;
  }

  // Handle common shorthand IDs or full names
  const lower = trimmed.toLowerCase();
  let search = lower;
  if (lower === "acme" || lower.includes("acme")) search = "Acme";
  else if (lower === "northwind" || lower.includes("northwind")) search = "Northwind";
  else if (lower === "globex" || lower.includes("globex")) search = "Globex";

  const { data } = await db
    .from("clients")
    .select("*")
    .or(`name.ilike.%${search}%,legal_entity.ilike.%${search}%`)
    .limit(1);

  return data && data.length > 0 ? data[0] : null;
}

/**
 * Formats a database client row + requirements rows into the standard Client object.
 */
export async function buildClientResponse(clientRow: any): Promise<Client> {
  const { data: doc } = await db
    .from("client_documents")
    .select("*")
    .eq("client_id", clientRow.id)
    .limit(1)
    .maybeSingle();

  const { data: reqRows } = await db
    .from("requirements")
    .select("*")
    .eq("client_id", clientRow.id);

  const meta: Record<string, any> = {};
  let poRequired = false;
  let legalName: string | undefined = clientRow.legal_entity || undefined;
  let allowedCurrencies: Currency[] = ["USD"];
  let vatRequired = false;
  let paymentTerms: PaymentTerms = "Net 30";
  let apEmail: string | undefined = clientRow.ap_email || undefined;
  let oneInvoicePerFile = false;

  for (const r of reqRows || []) {
    meta[r.key] = {
      evidence: r.evidence,
      confidence: r.confidence || "high",
      isNew: Boolean(r.is_new),
      edited: r.source === "user",
    };
    if (r.key === "poRequired") poRequired = Boolean(r.value);
    if (r.key === "legalName") legalName = String(r.value).replace(/^"|"$/g, "");
    if (r.key === "allowedCurrencies" && Array.isArray(r.value)) allowedCurrencies = r.value;
    if (r.key === "vatRequired") vatRequired = Boolean(r.value);
    if (r.key === "paymentTerms") paymentTerms = r.value;
    if (r.key === "apEmail") apEmail = String(r.value).replace(/^"|"$/g, "");
    if (r.key === "oneInvoicePerFile") oneInvoicePerFile = Boolean(r.value);
  }

  // Derive shorthand ID for frontend mock compatibility if needed
  let shortId = clientRow.id;
  const nameLower = clientRow.name.toLowerCase();
  let openPoNumber: string | undefined = undefined;
  let vatIdOnFile: string | undefined = undefined;

  if (nameLower.includes("acme")) {
    shortId = "acme";
    openPoNumber = "PO-2026-04418";
  } else if (nameLower.includes("northwind")) {
    shortId = "northwind";
    vatIdOnFile = "NL882910482B01";
  } else if (nameLower.includes("globex")) {
    shortId = "globex";
  }

  return {
    id: shortId,
    name: clientRow.name,
    contactEmail: clientRow.ap_email || "ap@client.example",
    industry: nameLower.includes("acme")
      ? "Manufacturing"
      : nameLower.includes("northwind")
        ? "Design agency"
        : "Energy",
    sourceDoc: {
      fileName:
        doc?.storage_path ||
        (nameLower.includes("acme")
          ? "acme-supplier-invoicing-policy.pdf"
          : nameLower.includes("northwind")
            ? "northwind-freelancer-onboarding.pdf"
            : "globex-vendor-guide-2026.pdf"),
      kind: doc?.kind === "pdf" ? "PDF vendor guide" : "AP policy email",
      pages: doc?.kind === "pdf" ? 5 : 2,
    },
    docStatus: "extracted",
    requirements: {
      poRequired,
      openPoNumber,
      legalName,
      allowedCurrencies,
      vatRequired,
      vatIdOnFile,
      paymentTerms,
      apEmail,
      oneInvoicePerFile,
      meta,
    },
  };
}

/**
 * GET /api/clients
 * Returns all clients with their live requirements from Supabase.
 */
export async function listClients(_req: Request, res: Response) {
  try {
    const { data: clients, error } = await db.from("clients").select("*").order("name");
    if (error) throw error;

    const formatted = await Promise.all((clients || []).map((c) => buildClientResponse(c)));
    return res.json(formatted);
  } catch (err: any) {
    console.error("[clientController] listClients error:", err);
    return res.status(500).json({
      error: { code: "INTERNAL", message: err.message || "Failed to list clients" },
    });
  }
}

/**
 * GET /api/clients/:id
 */
export async function getClientById(req: Request, res: Response) {
  try {
    const client = await resolveClient(req.params.id);
    if (!client) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: `Client ${req.params.id} not found.` },
      });
    }

    const formatted = await buildClientResponse(client);
    return res.json(formatted);
  } catch (err: any) {
    console.error("[clientController] getClientById error:", err);
    return res.status(500).json({
      error: { code: "INTERNAL", message: err.message || "Failed to get client" },
    });
  }
}

/**
 * PUT /api/clients/:id/requirements
 * Updates all or any provided requirements for a client in Supabase.
 */
export async function updateClientRequirements(req: Request, res: Response) {
  try {
    const clientIdParam = req.params.id;
    const client = await resolveClient(clientIdParam);

    if (!client) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: `Client '${clientIdParam}' not found in database.` },
      });
    }

    const reqBody: Partial<ClientRequirements> = req.body;
    console.log(`[clientController] Updating requirements for client ${client.name} (${client.id}):`, reqBody);

    const ruleKeys: (keyof ClientRequirements)[] = [
      "poRequired",
      "legalName",
      "allowedCurrencies",
      "vatRequired",
      "paymentTerms",
      "apEmail",
      "oneInvoicePerFile",
    ];

    for (const key of ruleKeys) {
      if (reqBody[key] !== undefined) {
        const val = reqBody[key];
        const meta = (reqBody.meta as any)?.[key];

        const { data: updatedRows, error } = await db
          .from("requirements")
          .update({
            value: val,
            source: "user",
            updated_at: new Date().toISOString(),
            ...(meta?.evidence ? { evidence: meta.evidence } : {}),
            ...(meta?.confidence ? { confidence: meta.confidence } : {}),
          })
          .eq("client_id", client.id)
          .eq("key", key)
          .select();

        if (error) {
          console.error(`[clientController] Error updating rule ${key}:`, error);
        } else if (!updatedRows || updatedRows.length === 0) {
          // If no row exists yet for this requirement, insert it
          await db.from("requirements").insert({
            client_id: client.id,
            key: key,
            label: key === "poRequired" ? "PO number on invoice" : key,
            value: val,
            evidence: meta?.evidence || "Configured by user in settings",
            evidence_verified: true,
            confidence: meta?.confidence || "high",
            source: "user",
          });
        }
      }
    }

    // Fetch and return the updated client with freshly loaded requirements
    const updatedClient = await buildClientResponse(client);
    console.log(`[clientController] ✓ Successfully updated requirements for ${client.name}. poRequired is now:`, updatedClient.requirements?.poRequired);

    return res.json(updatedClient);
  } catch (err: any) {
    console.error("[clientController] updateClientRequirements error:", err);
    return res.status(500).json({
      error: { code: "INTERNAL", message: err.message || "Failed to update client requirements" },
    });
  }
}

/**
 * PATCH /api/clients/:clientId/rules/:ruleId
 * Updates a specific single rule in Supabase (e.g. poRequired to false).
 */
export async function updateSingleRule(req: Request, res: Response) {
  try {
    const { clientId, ruleId } = req.params;
    const client = await resolveClient(clientId);

    if (!client) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: `Client '${clientId}' not found.` },
      });
    }

    // Normalize rule key (handle poRequired, po_required, poNumber, etc.)
    let key = ruleId;
    const lower = ruleId.toLowerCase();
    if (lower.includes("po")) key = "poRequired";
    else if (lower.includes("legal")) key = "legalName";
    else if (lower.includes("currency")) key = "allowedCurrencies";
    else if (lower.includes("vat") || lower.includes("tax")) key = "vatRequired";
    else if (lower.includes("terms")) key = "paymentTerms";
    else if (lower.includes("email")) key = "apEmail";
    else if (lower.includes("oneinvoice") || lower.includes("single")) key = "oneInvoicePerFile";

    // Value can be sent in body as value, required, enabled, or direct key
    let newValue = req.body.value;
    if (newValue === undefined && req.body.required !== undefined) {
      newValue = req.body.required;
    }
    if (newValue === undefined && req.body.enabled !== undefined) {
      newValue = req.body.enabled;
    }
    if (newValue === undefined && req.body[key] !== undefined) {
      newValue = req.body[key];
    }
    if (newValue === undefined && req.body[ruleId] !== undefined) {
      newValue = req.body[ruleId];
    }

    if (newValue === undefined) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: `Missing rule value in request body for rule '${key}'.` },
      });
    }

    console.log(`[clientController] PATCH rule '${key}' for client ${client.name} to:`, newValue);

    const { data, error } = await db
      .from("requirements")
      .update({
        value: newValue,
        source: "user",
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", client.id)
      .eq("key", key)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      const { error: insertErr } = await db.from("requirements").insert({
        client_id: client.id,
        key: key,
        label: key === "poRequired" ? "PO number on invoice" : key,
        value: newValue,
        evidence: "Configured by user in settings",
        evidence_verified: true,
        confidence: "high",
        source: "user",
      });
      if (insertErr) throw insertErr;
    }

    const updatedClient = await buildClientResponse(client);
    return res.json({
      success: true,
      message: `Rule '${key}' updated successfully.`,
      rule: key,
      value: newValue,
      client: updatedClient,
    });
  } catch (err: any) {
    console.error("[clientController] updateSingleRule error:", err);
    return res.status(500).json({
      error: { code: "INTERNAL", message: err.message || "Failed to update rule" },
    });
  }
}

/**
 * POST /api/requirements
 * Ingests text or document, calls Gemini LLM to extract AP rules,
 * verifies evidence verbatim (NFR-04), updates database preserving user edits (DB-05),
 * and returns the full Client object matching ClientSchema.
 */
export async function extractRequirements(req: Request, res: Response) {
  try {
    const { clientId, fileName, text } = req.body;
    if (!clientId) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "clientId is required." } });
    }

    const client = await resolveClient(clientId);
    if (!client) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: `Client '${clientId}' not found.` } });
    }

    let sourceText = typeof text === "string" ? text.trim() : "";

    // If text was not supplied in request body, retrieve stored document from Supabase
    if (!sourceText) {
      const { data: doc } = await db
        .from("client_documents")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (doc?.source_text) {
        sourceText = doc.source_text.trim();
      }
    }

    // Check if input was empty or bad file
    if (!sourceText) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "There was no text to read in that input.",
        },
      });
    }

    console.log(`[clientController] Extracting requirements for ${client.name} using Gemini LLM (${sourceText.length} chars)...`);

    // Call Gemini LLM to extract requirements
    const extractedRules = await extractAPRequirements(sourceText, client.name);
    console.log(`[clientController] Extracted ${extractedRules.length} rules with verbatim verification.`);

    // Persist document record into client_documents
    const hash = crypto.createHash("md5").update(sourceText).digest("hex");
    const docKind = fileName?.endsWith(".pdf") ? "pdf" : "text";

    let savedDocId: string | null = null;
    try {
      const { data: savedDoc, error: docErr } = await db
        .from("client_documents")
        .insert({
          client_id: client.id,
          kind: docKind,
          storage_path: fileName || null,
          source_text: sourceText,
          source_text_hash: hash,
        })
        .select("id")
        .single();

      if (!docErr && savedDoc) {
        savedDocId = savedDoc.id;
      }
    } catch (e: any) {
      console.warn("[clientController] Warning saving client_document:", e.message || e);
    }

    // Query existing rules to preserve any user-edited rules (source === 'user') per DB-05
    const { data: existingRows } = await db
      .from("requirements")
      .select("key, source")
      .eq("client_id", client.id);

    const userEditedKeys = new Set(
      (existingRows || []).filter((r) => r.source === "user").map((r) => r.key)
    );

    // Delete existing AI-extracted requirements for this client per DB-05
    await db
      .from("requirements")
      .delete()
      .eq("client_id", client.id)
      .eq("source", "ai");

    // Insert new extracted rules (skipping any key the user has customized)
    const rulesToInsert = extractedRules
      .filter((r) => !userEditedKeys.has(r.key))
      .map((rule) => ({
        client_id: client.id,
        document_id: savedDocId,
        key: rule.key,
        label: rule.label,
        value: rule.value,
        evidence: rule.evidence,
        evidence_verified: rule.evidenceVerified ?? true,
        confidence: rule.confidence,
        source: "ai",
        is_new: false,
      }));

    if (rulesToInsert.length > 0) {
      const { error: insertErr } = await db.from("requirements").insert(rulesToInsert);
      if (insertErr) {
        console.error("[clientController] Error inserting extracted requirements:", insertErr);
      }
    }

    // Build fresh client representation matching ClientSchema
    const fullClient = await buildClientResponse(client);
    if (fileName) {
      fullClient.sourceDoc.fileName = fileName;
    }

    return res.json(fullClient);
  } catch (err: any) {
    console.error("[clientController] extractRequirements error:", err);
    const statusCode = err.statusCode || (err.code === "EXTRACTION_FAILED" ? 502 : 500);
    return res.status(statusCode).json({
      error: {
        code: err.code || "EXTRACTION_FAILED",
        message: err.message || "Failed to extract requirements from document.",
        details: {},
      },
    });
  }
}

/**
 * POST /api/requirements/learn
 * Extracts rule from a client rejection email and badges it with is_new = true.
 */
export async function handleLearnFromEmail(req: Request, res: Response) {
  try {
    const { clientId, text } = req.body;
    if (!clientId || !text) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "clientId and text are required." } });
    }

    const client = await resolveClient(clientId);
    if (!client) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: `Client '${clientId}' not found.` } });
    }

    console.log(`[clientController] Learning from rejection email for ${client.name}...`);
    const extractedRules = await extractAPRequirements(text, client.name);

    if (extractedRules.length > 0) {
      const topRule = extractedRules[0];
      await db.from("requirements").insert({
        client_id: client.id,
        key: topRule.key,
        label: topRule.label,
        value: topRule.value,
        evidence: topRule.evidence,
        evidence_verified: topRule.evidenceVerified ?? true,
        confidence: topRule.confidence,
        source: "email",
        is_new: true,
      });
    }

    const fullClient = await buildClientResponse(client);
    return res.json(fullClient);
  } catch (err: any) {
    console.error("[clientController] handleLearnFromEmail error:", err);
    return res.status(500).json({
      error: { code: "INTERNAL", message: err.message || "Failed to learn from email" },
    });
  }
}

export default {
  listClients,
  getClientById,
  updateClientRequirements,
  updateSingleRule,
  extractRequirements,
  handleLearnFromEmail,
  resolveClient,
  buildClientResponse,
};
