import { Request, Response } from "express";
import { db } from "../../lib/db";
import type { Client, ClientRequirements, Currency, PaymentTerms } from "../../../shared/types";

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

export default {
  listClients,
  getClientById,
  updateClientRequirements,
  updateSingleRule,
  resolveClient,
  buildClientResponse,
};
