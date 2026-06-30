export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireApiContext } from "@/lib/api-context";
import { findDeliveryNoteForInvoice } from "@/lib/delivery-note-from-invoice";

function createAdminClient(): SupabaseClient | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await ctx.params;

  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  const admin = createAdminClient();
  const client = admin ?? supabase;

  const found = await findDeliveryNoteForInvoice(client, orgId, invoiceId);
  if (!found.ok) {
    return NextResponse.json({ error: found.error }, { status: 400 });
  }

  if (!found.dn?.id) {
    return NextResponse.json({ ok: true, exists: false });
  }

  const { data, error } = await client
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
