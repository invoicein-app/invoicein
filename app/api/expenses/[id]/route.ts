export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/log-activity";
import { requireCanWrite } from "@/lib/subscription";
import { isExpenseCategory, parseExpensePaymentMethodInput } from "@/lib/expense-categories";
import { asText, getAuthAndOrg, getSupabaseFromCookies, num } from "@/lib/api-auth-org";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { user, orgId, actorRole } = auth;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { data: before, error: beforeErr } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (beforeErr) return NextResponse.json({ error: beforeErr.message }, { status: 400 });
  if (!before) return NextResponse.json({ error: "Pengeluaran tidak ditemukan." }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.expense_date !== undefined) {
    const d = asText(body.expense_date);
    if (!d) return NextResponse.json({ error: "Tanggal wajib diisi." }, { status: 400 });
    patch.expense_date = d;
  }
  if (body.category !== undefined) {
    const c = asText(body.category);
    if (!isExpenseCategory(c)) return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });
    patch.category = c;
  }
  if (body.description !== undefined) {
    const d = asText(body.description);
    if (!d) return NextResponse.json({ error: "Deskripsi wajib diisi." }, { status: 400 });
    patch.description = d;
  }
  if (body.amount !== undefined) {
    const a = Math.max(0, num(body.amount));
    if (a <= 0) return NextResponse.json({ error: "Nominal harus lebih dari 0." }, { status: 400 });
    patch.amount = a;
  }
  if (body.payment_status !== undefined) {
    patch.payment_status = body.payment_status === "unpaid" ? "unpaid" : "paid";
  }
  if (body.payment_method !== undefined) {
    patch.payment_method = parseExpensePaymentMethodInput(body.payment_method);
  }
  if (body.notes !== undefined) patch.notes = asText(body.notes) || null;

  const { data: row, error } = await supabase
    .from("expenses")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "expense.update",
    entity_type: "expense",
    entity_id: row.id,
    summary: `Update pengeluaran ${row.description}`,
    meta: { before, after: row },
  });

  return NextResponse.json({ ok: true, expense: row });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { user, orgId, actorRole } = auth;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const { data: before, error: beforeErr } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (beforeErr) return NextResponse.json({ error: beforeErr.message }, { status: 400 });
  if (!before) return NextResponse.json({ error: "Pengeluaran tidak ditemukan." }, { status: 404 });

  const { error } = await supabase.from("expenses").delete().eq("id", id).eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "expense.delete",
    entity_type: "expense",
    entity_id: id,
    summary: `Hapus pengeluaran ${before.description}`,
    meta: { before },
  });

  return NextResponse.json({ ok: true });
}
