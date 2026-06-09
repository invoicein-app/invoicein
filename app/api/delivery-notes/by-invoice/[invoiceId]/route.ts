export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await ctx.params;

  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { data, error } = await supabase
    .from("delivery_notes")
    .select("id, sj_number, sj_date, invoice_id")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // kalau belum ada
  if (!data) {
    return NextResponse.json({ ok: true, exists: false });
  }

  return NextResponse.json({
    ok: true,
    exists: true,
    deliveryNote: data,
  });
}