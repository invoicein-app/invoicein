export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/log-activity";
import { requireCanWrite } from "@/lib/subscription";
import { isExpenseCategory } from "@/lib/expense-categories";
import {
  isIsoWeekday,
  isRecurringFrequency,
  validateRecurringTemplateState,
  type RecurringFrequency,
} from "@/lib/expense-recurring";
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
    .from("expense_recurring_templates")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (beforeErr) return NextResponse.json({ error: beforeErr.message }, { status: 400 });
  if (!before) return NextResponse.json({ error: "Template tidak ditemukan." }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) {
    const n = asText(body.name);
    if (!n) return NextResponse.json({ error: "Nama wajib diisi." }, { status: 400 });
    patch.name = n;
  }
  if (body.category !== undefined) {
    const c = asText(body.category);
    if (!isExpenseCategory(c)) return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });
    patch.category = c;
  }
  if (body.default_amount !== undefined) {
    const a = Math.max(0, num(body.default_amount));
    if (a <= 0) return NextResponse.json({ error: "Nominal default harus > 0." }, { status: 400 });
    patch.default_amount = a;
  }
  if (body.is_active !== undefined) patch.is_active = body.is_active === false ? false : true;
  if (body.notes !== undefined) patch.notes = asText(body.notes) || null;

  const mergedFrequency = (
    body.frequency !== undefined ? String(body.frequency) : before.frequency || "monthly"
  ) as RecurringFrequency;
  if (body.frequency !== undefined && !isRecurringFrequency(mergedFrequency)) {
    return NextResponse.json({ error: "Frekuensi tidak valid." }, { status: 400 });
  }
  if (body.frequency !== undefined) patch.frequency = mergedFrequency;

  const mergedForSchedule = {
    frequency: mergedFrequency,
    due_day_of_month:
      body.due_day_of_month !== undefined
        ? body.due_day_of_month === null || body.due_day_of_month === ""
          ? null
          : Math.floor(num(body.due_day_of_month))
        : before.due_day_of_month,
    due_day_of_week:
      body.due_day_of_week !== undefined
        ? body.due_day_of_week === null || body.due_day_of_week === ""
          ? null
          : Math.floor(num(body.due_day_of_week))
        : before.due_day_of_week,
  };

  if (body.frequency !== undefined || body.due_day_of_month !== undefined || body.due_day_of_week !== undefined) {
    patch.frequency = mergedFrequency;
    if (mergedFrequency === "monthly") {
      const d = Math.floor(num(mergedForSchedule.due_day_of_month));
      if (d < 1 || d > 31) {
        return NextResponse.json({ error: "Tanggal jatuh tempo harus 1–31." }, { status: 400 });
      }
      patch.due_day_of_month = d;
      patch.due_day_of_week = null;
    } else if (mergedFrequency === "weekly") {
      const w = Math.floor(num(mergedForSchedule.due_day_of_week));
      if (!isIsoWeekday(w)) {
        return NextResponse.json({ error: "Hari wajib dipilih untuk frekuensi mingguan." }, { status: 400 });
      }
      patch.due_day_of_week = w;
      patch.due_day_of_month = null;
    } else {
      patch.due_day_of_month = null;
      patch.due_day_of_week = null;
    }
  }

  const afterMerge = {
    frequency: (patch.frequency ?? before.frequency ?? "monthly") as RecurringFrequency,
    due_day_of_month:
      patch.due_day_of_month !== undefined ? (patch.due_day_of_month as number | null) : before.due_day_of_month,
    due_day_of_week:
      patch.due_day_of_week !== undefined ? (patch.due_day_of_week as number | null) : before.due_day_of_week,
  };
  const stateErr = validateRecurringTemplateState(afterMerge);
  if (stateErr) return NextResponse.json({ error: stateErr }, { status: 400 });

  const { data: row, error } = await supabase
    .from("expense_recurring_templates")
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
    action: "expense_recurring.update",
    entity_type: "expense_recurring_template",
    entity_id: row.id,
    summary: `Update biaya berulang ${row.name}`,
    meta: { before, after: row },
  });

  return NextResponse.json({ ok: true, template: row });
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
    .from("expense_recurring_templates")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (beforeErr) return NextResponse.json({ error: beforeErr.message }, { status: 400 });
  if (!before) return NextResponse.json({ error: "Template tidak ditemukan." }, { status: 404 });

  const { error } = await supabase
    .from("expense_recurring_templates")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "expense_recurring.delete",
    entity_type: "expense_recurring_template",
    entity_id: id,
    summary: `Hapus biaya berulang ${before.name}`,
    meta: { before },
  });

  return NextResponse.json({ ok: true });
}
