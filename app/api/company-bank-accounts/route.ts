export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAuthAndOrg, getSupabaseFromCookies } from "@/lib/api-auth-org";
import { requireCanWrite } from "@/lib/subscription";
import {
  clearOtherDefaultBankAccounts,
  listCompanyBankAccounts,
} from "@/lib/company-bank-accounts";

function asText(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;

  const activeOnly = req.nextUrl.searchParams.get("active_only") === "1";

  try {
    const items = await listCompanyBankAccounts({
      supabase,
      orgId: auth.orgId,
      activeOnly,
    });
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal memuat rekening." }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;

  const subBlock = await requireCanWrite(supabase, auth.orgId);
  if (subBlock) return subBlock;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const bank_name = asText(body.bank_name);
  const account_number = asText(body.account_number);
  const account_holder_name = asText(body.account_holder_name);
  const branch = asText(body.branch) || null;
  const is_active = body.is_active !== false;
  const is_default = Boolean(body.is_default);

  if (!bank_name || !account_number || !account_holder_name) {
    return NextResponse.json(
      { error: "Nama bank, nomor rekening, dan atas nama wajib diisi." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { data: created, error } = await supabase
    .from("company_bank_accounts")
    .insert({
      org_id: auth.orgId,
      bank_name,
      account_number,
      account_holder_name,
      branch,
      is_active,
      is_default,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (is_default && created?.id) {
    await clearOtherDefaultBankAccounts(supabase, auth.orgId, String(created.id));
  } else if (!is_default) {
    const { count } = await supabase
      .from("company_bank_accounts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", auth.orgId);

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
