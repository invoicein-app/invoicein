export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAuthAndOrg, getSupabaseFromCookies } from "@/lib/api-auth-org";
import { requireCanWrite } from "@/lib/subscription";
import { clearOtherDefaultBankAccounts } from "@/lib/company-bank-accounts";

function asText(v: unknown) {
  return String(v ?? "").trim();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const accountId = asText(id);
  if (!accountId) {
    return NextResponse.json({ error: "ID rekening wajib." }, { status: 400 });
  }

  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;

  const subBlock = await requireCanWrite(supabase, auth.orgId);
  if (subBlock) return subBlock;

  const { data: existing, error: findErr } = await supabase
    .from("company_bank_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("org_id", auth.orgId)
    .maybeSingle();

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 400 });
  if (!existing) return NextResponse.json({ error: "Rekening tidak ditemukan." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.bank_name != null) patch.bank_name = asText(body.bank_name);
  if (body.account_number != null) patch.account_number = asText(body.account_number);
  if (body.account_holder_name != null) patch.account_holder_name = asText(body.account_holder_name);
  if (body.branch != null) patch.branch = asText(body.branch) || null;
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  if (typeof body.is_default === "boolean") patch.is_default = body.is_default;

  if (!asText(patch.bank_name ?? existing.bank_name) || !asText(patch.account_number ?? existing.account_number) || !asText(patch.account_holder_name ?? existing.account_holder_name)) {
    return NextResponse.json(
      { error: "Nama bank, nomor rekening, dan atas nama wajib diisi." },
      { status: 400 }
    );
  }

  const { data: updated, error: upErr } = await supabase
    .from("company_bank_accounts")
    .update(patch)
    .eq("id", accountId)
    .eq("org_id", auth.orgId)
    .select("*")
    .single();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  if (updated?.is_default) {
    await clearOtherDefaultBankAccounts(supabase, auth.orgId, accountId);
  }

  if (updated && !updated.is_active && updated.is_default) {
    await supabase
      .from("company_bank_accounts")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("id", accountId);

    const { data: nextDefault } = await supabase
      .from("company_bank_accounts")
      .select("id")
      .eq("org_id", auth.orgId)
      .eq("is_active", true)
      .neq("id", accountId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextDefault?.id) {
      await supabase
        .from("company_bank_accounts")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", nextDefault.id);
    }

    updated.is_default = false;
  }

  return NextResponse.json({ ok: true, item: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const accountId = asText(id);
  if (!accountId) {
    return NextResponse.json({ error: "ID rekening wajib." }, { status: 400 });
  }

  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;

  const subBlock = await requireCanWrite(supabase, auth.orgId);
  if (subBlock) return subBlock;

  const { data: existing } = await supabase
    .from("company_bank_accounts")
    .select("id, is_default")
    .eq("id", accountId)
    .eq("org_id", auth.orgId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Rekening tidak ditemukan." }, { status: 404 });
  }

  const { error } = await supabase
    .from("company_bank_accounts")
    .delete()
    .eq("id", accountId)
    .eq("org_id", auth.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (existing.is_default) {
    const { data: nextDefault } = await supabase
      .from("company_bank_accounts")
      .select("id")
      .eq("org_id", auth.orgId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextDefault?.id) {
      await supabase
        .from("company_bank_accounts")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", nextDefault.id);
    }
  }

  return NextResponse.json({ ok: true });
}
