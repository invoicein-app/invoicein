import { createClient } from "@supabase/supabase-js";

export type DocumentType = "invoice" | "purchase_order" | "quotation";

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

function padSequence(seq: number) {
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

export async function generateDocumentNumber(params: {
  orgId: string;
  docType: DocumentType;
  documentDate: string;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for document numbering.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("public_document_code, invoice_prefix, po_prefix, quotation_prefix")
    .eq("id", params.orgId)
    .single();

  if (orgErr || !org) {
    throw new Error(orgErr?.message || "Organization not found.");
  }

  const normalizedDate = coerceDateOrToday(params.documentDate);
  const year = normalizedDate.slice(0, 4);
  const fullDate = formatDateForNumber(normalizedDate);
  const publicCode = normalizePublicCode((org as any).public_document_code);

  const rawPrefix =
    params.docType === "invoice"
      ? (org as any).invoice_prefix
      : params.docType === "purchase_order"
      ? (org as any).po_prefix
      : (org as any).quotation_prefix;

  const prefix = normalizePrefix(rawPrefix, DEFAULT_PREFIX[params.docType]);

  const { data: seq, error: seqErr } = await admin.rpc("next_document_sequence", {
    p_org_id: params.orgId,
    p_doc_type: params.docType,
    p_period_key: year,
  });

  if (seqErr) {
    throw new Error(seqErr.message || "Failed to generate document sequence.");
  }

  const sequence = Number(seq);
  if (!Number.isFinite(sequence) || sequence < 1) {
    throw new Error("Invalid document sequence returned from database.");
  }

  const padded = padSequence(sequence);
  return publicCode
    ? `${prefix}-${publicCode}-${fullDate}-${padded}`
    : `${prefix}-${fullDate}-${padded}`;
}
