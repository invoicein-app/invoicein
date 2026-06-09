export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { clearOtherDefaultBankAccounts } from "@/lib/company-bank-accounts";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { updateBankAccountBodySchema } from "@/lib/validations/company-bank-account";

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

  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  const { data: existing, error: findErr } = await supabase
    .from("company_bank_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 400 });
  if (!existing) return NextResponse.json({ error: "Rekening tidak ditemukan." }, { status: 404 });

  const parsedBody = await parseJsonBody(req, updateBankAccountBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.bank_name !== undefined) patch.bank_name = body.bank_name;
  if (body.account_number !== undefined) patch.account_number = body.account_number;
  if (body.account_holder_name !== undefined) patch.account_holder_name = body.account_holder_name;
  if (body.branch !== undefined) patch.branch = body.branch;
  if (body.is_active !== undefined) patch.is_active = body.is_active;
  if (body.is_default !== undefined) patch.is_default = body.is_default;

  if (
    !asText(patch.bank_name ?? existing.bank_name) ||
    !asText(patch.account_number ?? existing.account_number) ||
    !asText(patch.account_holder_name ?? existing.account_holder_name)
  ) {
    return NextResponse.json(
      { error: "Nama bank, nomor rekening, dan atas nama wajib diisi." },
      { status: 400 }
    );
  }

  const { data: updated, error: upErr } = await supabase
    .from("company_bank_accounts")
    .update(patch)
    .eq("id", accountId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  if (updated?.is_default) {
    await clearOtherDefaultBankAccounts(supabase, orgId, accountId);
  }

  if (updated && !updated.is_active && updated.is_default) {
    await supabase
      .from("company_bank_accounts")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("id", accountId);

    const { data: nextDefault } = await supabase
      .from("company_bank_accounts")
      .select("id")
      .eq("org_id", orgId)
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

  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  const { data: existing } = await supabase
    .from("company_bank_accounts")
    .select("id, is_default")
    .eq("id", accountId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Rekening tidak ditemukan." }, { status: 404 });
  }

  const { error } = await supabase
    .from("company_bank_accounts")
    .delete()
    .eq("id", accountId)
    .eq("org_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (existing.is_default) {
    const { data: nextDefault } = await supabase
      .from("company_bank_accounts")
      .select("id")
      .eq("org_id", orgId)
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
