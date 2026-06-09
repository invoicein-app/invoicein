export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";

export async function GET() {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  const [custRes, vendorRes] = await Promise.all([
    supabase.from("customers").select("id, name").eq("org_id", orgId).order("name", { ascending: true }),
    supabase.from("vendors").select("id, name").eq("org_id", orgId).order("name", { ascending: true }),
  ]);

  if (custRes.error) return NextResponse.json({ error: custRes.error.message }, { status: 400 });
  if (vendorRes.error) return NextResponse.json({ error: vendorRes.error.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    customers: custRes.data || [],
    vendors: vendorRes.data || [],
  });
}
