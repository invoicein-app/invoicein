export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { assessInvoiceDeletable, formatInvoiceDeleteBlockedMessage, isInvoiceDeleteAdmin } from "@/lib/invoice-delete";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;

  const { supabase, orgId, actorRole } = auth.ctx;

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, org_id, status, amount_paid, quotation_id")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }
  if (!invoice) {
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }

  const assessment = await assessInvoiceDeletable({
    supabase,
    orgId,
    invoice,
    actorRole,
  });

  return NextResponse.json({
    can_delete: assessment.canDelete,
    reasons: assessment.reasons,
    blockers: assessment.blockers,
    admin_override: assessment.adminOverride ?? false,
    is_admin: isInvoiceDeleteAdmin(actorRole),
    message: assessment.canDelete
      ? null
      : formatInvoiceDeleteBlockedMessage(assessment.reasons),
  });
}
