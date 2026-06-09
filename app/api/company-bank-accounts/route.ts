export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import {
  clearOtherDefaultBankAccounts,
  listCompanyBankAccounts,
} from "@/lib/company-bank-accounts";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { createBankAccountBodySchema } from "@/lib/validations/company-bank-account";

export async function GET(req: NextRequest) {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  const activeOnly = req.nextUrl.searchParams.get("active_only") === "1";

  try {
    const items = await listCompanyBankAccounts({
      supabase,
      orgId,
      activeOnly,
    });
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal memuat rekening." }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  const parsedBody = await parseJsonBody(req, createBankAccountBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const now = new Date().toISOString();
  const { data: created, error } = await supabase
    .from("company_bank_accounts")
    .insert({
      org_id: orgId,
      bank_name: body.bank_name,
      account_number: body.account_number,
      account_holder_name: body.account_holder_name,
      branch: body.branch,
      is_active: body.is_active,
      is_default: body.is_default,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (body.is_default && created?.id) {
    await clearOtherDefaultBankAccounts(supabase, orgId, String(created.id));
  } else if (!body.is_default) {
    const { count } = await supabase
      .from("company_bank_accounts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId);

    if ((count || 0) <= 1 && created?.id) {
      await supabase
        .from("company_bank_accounts")
        .update({ is_default: true, updated_at: now })
        .eq("id", created.id);
      created.is_default = true;
    }
  }

  return NextResponse.json({ ok: true, item: created });
}
