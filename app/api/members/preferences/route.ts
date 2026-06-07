export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAppOrg } from "@/lib/auth/get-app-org";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const org = await getAppOrg();
  if (!org.ok) {
    return NextResponse.json(
      { error: org.reason === "unauthorized" ? "Unauthorized" : org.message },
      { status: org.reason === "unauthorized" ? 401 : 400 }
    );
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("memberships")
    .select("show_invoice_bookkeeping_status")
    .eq("user_id", org.userId)
    .eq("org_id", org.orgId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    show_invoice_bookkeeping_status: Boolean(data?.show_invoice_bookkeeping_status),
  });
}

export async function PATCH(req: NextRequest) {
  const org = await getAppOrg();
  if (!org.ok) {
    return NextResponse.json(
      { error: org.reason === "unauthorized" ? "Unauthorized" : org.message },
      { status: org.reason === "unauthorized" ? 401 : 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    show_invoice_bookkeeping_status?: boolean;
  };

  if (typeof body.show_invoice_bookkeeping_status !== "boolean") {
    return NextResponse.json(
      { error: "show_invoice_bookkeeping_status (boolean) wajib" },
      { status: 400 }
    );
  }

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("memberships")
    .update({ show_invoice_bookkeeping_status: body.show_invoice_bookkeeping_status })
    .eq("user_id", org.userId)
    .eq("org_id", org.orgId)
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    show_invoice_bookkeeping_status: body.show_invoice_bookkeeping_status,
  });
}
