export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiContext } from "@/lib/api-context";

export async function GET() {
  const auth = await requireApiContext({ requireAdmin: true });
  if (!auth.ok) return auth.response;
  const { orgId } = auth.ctx;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // org_code + plan untuk ditampilkan ke admin
  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, org_code, subscription_plan")
    .eq("id", orgId)
    .maybeSingle();

  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 400 });

  const { data: members, error: membersErr } = await admin
    .from("memberships")
    .select("id, user_id, org_id, username, role, created_at, is_active")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (membersErr) return NextResponse.json({ error: membersErr.message }, { status: 400 });

  const plan = (orgRow?.subscription_plan as "basic" | "standard") || "basic";
  const staffLimit = plan === "standard" ? 3 : 1;
  const staffUsed = (members || []).filter((m: any) => m.role === "staff" && m.is_active === true).length;

  return NextResponse.json(
    {
      org: orgRow || null,
      members: members || [],
      staffLimit,
      staffUsed,
      subscriptionPlan: plan,
    },
    { status: 200 }
  );
}
