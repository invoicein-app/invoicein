export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAppOrg } from "@/lib/auth/get-app-org";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoiceId = String(id || "").trim();
  if (!invoiceId) {
    return NextResponse.json({ error: "Invoice id wajib" }, { status: 400 });
  }

  const org = await getAppOrg();
  if (!org.ok) {
    return NextResponse.json(
      { error: org.reason === "unauthorized" ? "Unauthorized" : org.message },
      { status: org.reason === "unauthorized" ? 401 : 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    bookkeeping_recorded?: boolean;
  };

  if (typeof body.bookkeeping_recorded !== "boolean") {
    return NextResponse.json(
      { error: "bookkeeping_recorded (boolean) wajib" },
      { status: 400 }
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: inv, error: findErr } = await admin
    .from("invoices")
    .select("id, org_id")
    .eq("id", invoiceId)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 400 });
  }
  if (!inv) {
    return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
  }
  if (String((inv as { org_id?: string }).org_id) !== org.orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: updated, error: upErr } = await admin
    .from("invoices")
    .update({ bookkeeping_recorded: body.bookkeeping_recorded })
    .eq("id", invoiceId)
    .eq("org_id", org.orgId)
    .select("id, bookkeeping_recorded")
    .maybeSingle();

  if (upErr) {
    if (/bookkeeping_recorded/i.test(upErr.message)) {
      return NextResponse.json(
        {
          error:
            "Kolom pencatatan belum ada di database. Jalankan migration 20260605120000_add_invoice_bookkeeping_status.sql di Supabase.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    id: updated.id,
    bookkeeping_recorded: updated.bookkeeping_recorded,
  });
}
