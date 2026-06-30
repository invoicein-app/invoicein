export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiContext } from "@/lib/api-context";
import { findDeliveryNoteForInvoice } from "@/lib/delivery-note-from-invoice";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await ctx.params;

  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { orgId } = auth.ctx;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Service role tidak tersedia." }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const found = await findDeliveryNoteForInvoice(admin, orgId, invoiceId);
  if (!found.ok) {
    return NextResponse.json({ error: found.error }, { status: 400 });
  }

  if (!found.dn?.id) {
    return NextResponse.json({ ok: true, exists: false });
  }

  const { data, error } = await admin
    .from("delivery_notes")
    .select("id, sj_number, sj_date, status, invoice_id")
    .eq("id", found.dn.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ ok: true, exists: false });
  }

  return NextResponse.json({
    ok: true,
    exists: true,
    deliveryNote: data,
  });
}
