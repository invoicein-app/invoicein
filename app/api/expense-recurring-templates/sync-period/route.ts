export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { logActivity } from "@/lib/log-activity";
import { requireCanWrite } from "@/lib/subscription";
import { createExpenseFromRecurringTemplate } from "@/lib/expense-recurring-create";
import { getAuthAndOrg, getSupabaseFromCookies } from "@/lib/api-auth-org";

/** Buat pengeluaran periode berjalan untuk semua template aktif yang belum ada. */
export async function POST() {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { user, orgId, actorRole } = auth;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const { data: templates, error: tplErr } = await supabase
    .from("expense_recurring_templates")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (tplErr) return NextResponse.json({ error: tplErr.message }, { status: 400 });

  let created = 0;
  let exists = 0;
  let skipped = 0;
  const createdNames: string[] = [];
  const errors: string[] = [];

  for (const template of templates || []) {
    const result = await createExpenseFromRecurringTemplate(supabase, orgId, template);
    if (result.status === "created") {
      created += 1;
      createdNames.push(template.name);
    } else if (result.status === "exists") {
      exists += 1;
    } else if (result.status === "skipped") {
      skipped += 1;
    } else if (result.status === "error") {
      errors.push(`${template.name}: ${result.error}`);
    }
  }

  if (created > 0) {
    await logActivity({
      org_id: orgId,
      actor_user_id: user.id,
      actor_role: actorRole,
      action: "expense.recurring_sync",
      entity_type: "expense_recurring_template",
      entity_id: orgId,
      summary: `Otomatis buat ${created} pengeluaran periode berjalan`,
      meta: { created, exists, skipped, createdNames },
    });
  }

  return NextResponse.json({
    ok: true,
    created,
    exists,
    skipped,
    createdNames,
    errors,
  });
}
