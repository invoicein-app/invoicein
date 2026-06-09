// app/api/org/profile/route.ts (FULL FILE)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { updateOrgProfileBodySchema } from "@/lib/validations/org";

function cleanCode(v: unknown, maxLen = 12) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, maxLen);
}

export async function POST(req: Request) {
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;

  const { supabase, orgId } = auth.ctx;

  const parsedBody = await parseJsonBody(req, updateOrgProfileBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const publicCode = cleanCode(body.public_document_code, 12);
  const invoicePrefix = cleanCode(body.invoice_prefix, 12) || "INV";
  const poPrefix = cleanCode(body.po_prefix, 12) || "PO";
  const quotationPrefix = cleanCode(body.quotation_prefix, 12) || "QUO";

  if (!invoicePrefix || !poPrefix || !quotationPrefix) {
    return NextResponse.json({ error: "Prefix dokumen tidak valid." }, { status: 400 });
  }

  const payload = {
    name: body.name,
    address: body.address,
    phone: body.phone,
    email: body.email,
    bank_name: body.bank_name,
    bank_account: body.bank_account,
    bank_account_name: body.bank_account_name,
    invoice_footer: body.invoice_footer,
    public_document_code: publicCode || null,
    invoice_prefix: invoicePrefix,
    po_prefix: poPrefix,
    quotation_prefix: quotationPrefix,
  };

  const { error: updErr } = await supabase
    .from("organizations")
    .update(payload)
    .eq("id", orgId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
