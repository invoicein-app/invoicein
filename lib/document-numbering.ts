import { createClient } from "@supabase/supabase-js";

export type DocumentType = "invoice" | "purchase_order" | "quotation";

export type DocumentNumberAllocation = {
  orgId: string;
  docType: DocumentType;
  periodKey: string;
  sequence: number;
  documentNumber: string;
};

const DEFAULT_PREFIX: Record<DocumentType, string> = {
  invoice: "INV",
  purchase_order: "PO",
  quotation: "QUO",
};

function normalizeUpperAlnumDash(value: unknown, maxLen: number) {
  const cleaned = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, maxLen);
  return cleaned || null;
}

function normalizePrefix(value: unknown, fallback: string) {
  return normalizeUpperAlnumDash(value, 12) || fallback;
}

function normalizePublicCode(value: unknown) {
  return normalizeUpperAlnumDash(value, 12);
}

function formatDateForNumber(dateLike: string) {
  const [y, m, d] = dateLike.split("-");
  return `${y}${m}${d}`;
}

export function padSequence(seq: number) {
  return String(seq).padStart(4, "0");
}

export function coerceDateOrToday(dateValue: unknown) {
  const s = String(dateValue ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function createNumberingAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for document numbering.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function formatDocumentNumber(args: {
  prefix: string;
  publicCode: string | null;
  documentDate: string;
  sequence: number;
}) {
  const fullDate = formatDateForNumber(args.documentDate);
  const padded = padSequence(args.sequence);
  return args.publicCode
    ? `${args.prefix}-${args.publicCode}-${fullDate}-${padded}`
    : `${args.prefix}-${fullDate}-${padded}`;
}

async function resolveNumberingConfig(
  admin: ReturnType<typeof createNumberingAdminClient>,
  params: { orgId: string; docType: DocumentType; documentDate: string }
) {
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("public_document_code, invoice_prefix, po_prefix, quotation_prefix")
    .eq("id", params.orgId)
    .single();

  if (orgErr || !org) {
    throw new Error(orgErr?.message || "Organization not found.");
  }

  const normalizedDate = coerceDateOrToday(params.documentDate);
  const periodKey = normalizedDate.slice(0, 4);
  const publicCode = normalizePublicCode((org as any).public_document_code);

  const rawPrefix =
    params.docType === "invoice"
      ? (org as any).invoice_prefix
      : params.docType === "purchase_order"
        ? (org as any).po_prefix
        : (org as any).quotation_prefix;

  const prefix = normalizePrefix(rawPrefix, DEFAULT_PREFIX[params.docType]);

  return { prefix, publicCode, periodKey, normalizedDate };
}

/** Preview the next document number without incrementing the counter. */
export async function peekDocumentNumber(params: {
  orgId: string;
  docType: DocumentType;
  documentDate: string;
}): Promise<string> {
  const admin = createNumberingAdminClient();
  const { prefix, publicCode, periodKey, normalizedDate } = await resolveNumberingConfig(admin, params);

  const { data: counter, error: counterErr } = await admin
    .from("document_counters")
    .select("last_number")
    .eq("org_id", params.orgId)
    .eq("doc_type", params.docType)
    .eq("period_key", periodKey)
    .maybeSingle();

  if (counterErr) {
    throw new Error(counterErr.message || "Failed to read document counter.");
  }

  const lastNumber = Number((counter as { last_number?: number } | null)?.last_number ?? 0);
  const sequence = Math.max(1, (Number.isFinite(lastNumber) ? lastNumber : 0) + 1);

  return formatDocumentNumber({
    prefix,
    publicCode,
    documentDate: normalizedDate,
    sequence,
  });
}

/** Reserve the next sequence and return formatted document number + metadata for rollback. */
export async function allocateDocumentNumber(params: {
  orgId: string;
  docType: DocumentType;
  documentDate: string;
}): Promise<DocumentNumberAllocation> {
  const admin = createNumberingAdminClient();
  const { prefix, publicCode, periodKey, normalizedDate } = await resolveNumberingConfig(admin, params);

  const { data: seq, error: seqErr } = await admin.rpc("next_document_sequence", {
    p_org_id: params.orgId,
    p_doc_type: params.docType,
    p_period_key: periodKey,
  });

  if (seqErr) {
    throw new Error(seqErr.message || "Failed to generate document sequence.");
  }

  const sequence = Number(seq);
  if (!Number.isFinite(sequence) || sequence < 1) {
    throw new Error("Invalid document sequence returned from database.");
  }

  return {
    orgId: params.orgId,
    docType: params.docType,
    periodKey,
    sequence,
    documentNumber: formatDocumentNumber({
      prefix,
      publicCode,
      documentDate: normalizedDate,
      sequence,
    }),
  };
}

/** Undo a sequence allocation when create failed before the document was committed. */
export async function releaseDocumentNumberAllocation(
  allocation: DocumentNumberAllocation | null | undefined
): Promise<boolean> {
  if (!allocation) return false;

  try {
    const admin = createNumberingAdminClient();
    const { data, error } = await admin.rpc("release_document_sequence", {
      p_org_id: allocation.orgId,
      p_doc_type: allocation.docType,
      p_period_key: allocation.periodKey,
      p_sequence: allocation.sequence,
    });

    if (error) {
      console.warn("release_document_sequence error:", error.message);
      return false;
    }

    return Boolean(data);
  } catch (e) {
    console.warn("release_document_sequence exception:", e);
    return false;
  }
}

export async function generateDocumentNumber(params: {
  orgId: string;
  docType: DocumentType;
  documentDate: string;
}) {
  const allocation = await allocateDocumentNumber(params);
  return allocation.documentNumber;
}
