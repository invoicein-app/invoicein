export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/log-activity";
import { requireCanWrite } from "@/lib/subscription";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { createRecurringExpenseBodySchema } from "@/lib/validations/expense";
import {
  normalizeRecurringTemplateBody,
  validateRecurringTemplateState,
} from "@/lib/expense-recurring";
import { getAuthAndOrg, getSupabaseFromCookies } from "@/lib/api-auth-org";

export async function GET() {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { orgId } = auth;

  const { data, error } = await supabase
    .from("expense_recurring_templates")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, templates: data || [], categories: EXPENSE_CATEGORIES });
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { user, orgId, actorRole } = auth;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const parsedBody = await parseJsonBody(req, createRecurringExpenseBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;
  const { category } = body;

  const parsed = normalizeRecurringTemplateBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const row = {
    ...parsed.data,
    category,
    org_id: orgId,
  };

  const stateErr = validateRecurringTemplateState({
    frequency: row.frequency!,
    due_day_of_month: row.due_day_of_month ?? null,
    due_day_of_week: row.due_day_of_week ?? null,
  });
  if (stateErr) return NextResponse.json({ error: stateErr }, { status: 400 });

  const { data: inserted, error } = await supabase
    .from("expense_recurring_templates")
    .insert({
      org_id: orgId,
      name: row.name!,
      category,
      default_amount: row.default_amount!,
      frequency: row.frequency!,
      due_day_of_month: row.frequency === "monthly" ? row.due_day_of_month : null,
      due_day_of_week: row.frequency === "weekly" ? row.due_day_of_week : null,
      is_active: row.is_active ?? true,
      notes: row.notes ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "expense_recurring.create",
    entity_type: "expense_recurring_template",
    entity_id: inserted.id,
    summary: `Buat biaya berulang ${inserted.name}`,
    meta: inserted,
  });

  return NextResponse.json({ ok: true, template: inserted });
}
