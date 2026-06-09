export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/log-activity";
import { requireCanWrite } from "@/lib/subscription";
import { createExpenseFromRecurringTemplate } from "@/lib/expense-recurring-create";
import { getAuthAndOrg, getSupabaseFromCookies } from "@/lib/api-auth-org";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { createExpenseFromRecurringBodySchema } from "@/lib/validations/expense";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: templateId } = await ctx.params;
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { user, orgId, actorRole } = auth;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const parsedBody = await parseJsonBody(req, createExpenseFromRecurringBodySchema);
  if (!parsedBody.ok) return parsedBody.response;

  const { data: template, error: tplErr } = await supabase
    .from("expense_recurring_templates")
    .select("*")
    .eq("id", templateId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (tplErr) return NextResponse.json({ error: tplErr.message }, { status: 400 });
  if (!template) return NextResponse.json({ error: "Template tidak ditemukan." }, { status: 404 });

  const result = await createExpenseFromRecurringTemplate(supabase, orgId, template, {
    month: parsedBody.data.month,
    week: parsedBody.data.week,
    date: parsedBody.data.date ?? undefined,
  });

  if (result.status === "skipped") {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  if (result.status === "error") {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  if (result.status === "exists") {
    return NextResponse.json(
      { error: `Pengeluaran untuk ${template.name} periode ini sudah dibuat.` },
      { status: 409 }
    );
  }

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "expense.create_from_recurring",
    entity_type: "expense",
    entity_id: String(result.expense.id),
    summary: `Buat pengeluaran dari biaya berulang ${template.name}`,
    meta: { template, expense: result.expense },
  });

  return NextResponse.json({ ok: true, expense: result.expense });
}
