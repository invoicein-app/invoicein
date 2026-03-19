/**
 * Billing admin: resolve payment confirmation (confirm or reject).
 * Access gated via lib/billing-admin.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getBillingAdminAuth } from "@/lib/billing-admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csAny: any = cookies() as any;
  const cookieStore = csAny?.then ? await csAny : csAny;
  const auth = await getBillingAdminAuth(cookieStore);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = (await params).id?.trim();
  if (!id) return NextResponse.json({ error: "ID wajib." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const status = String(body?.status ?? "").toLowerCase();
  if (status !== "confirmed" && status !== "rejected") {
    return NextResponse.json({ error: "status harus confirmed atau rejected." }, { status: 400 });
  }

  const adminNote = body?.admin_note != null ? String(body.admin_note).trim() : null;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: row, error } = await admin
    .from("payment_confirmations")
    .update({
      status,
      admin_note: adminNote,
      resolved_at: new Date().toISOString(),
      resolved_by: auth.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!row) return NextResponse.json({ error: "Konfirmasi tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ ok: true, id: row.id, status: row.status }, { status: 200 });
}
