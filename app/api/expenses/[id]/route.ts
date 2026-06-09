export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/log-activity";
import { parseExpensePaymentMethodInput } from "@/lib/expense-categories";
import { requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { updateExpenseBodySchema } from "@/lib/validations/expense";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId, actorRole } = auth.ctx;

  const parsedBody = await parseJsonBody(req, updateExpenseBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const { data: before, error: beforeErr } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (beforeErr) return NextResponse.json({ error: beforeErr.message }, { status: 400 });
  if (!before) return NextResponse.json({ error: "Pengeluaran tidak ditemukan." }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.expense_date !== undefined) patch.expense_date = body.expense_date;
  if (body.category !== undefined) patch.category = body.category;
  if (body.description !== undefined) patch.description = body.description;
  if (body.amount !== undefined) patch.amount = body.amount;
  if (body.payment_status !== undefined) patch.payment_status = body.payment_status;
  if (body.payment_method !== undefined) {
    patch.payment_method = parseExpensePaymentMethodInput(body.payment_method);
  }
  if (body.notes !== undefined) patch.notes = body.notes;

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
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId, actorRole } = auth.ctx;

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
