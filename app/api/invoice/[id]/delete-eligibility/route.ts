export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { assessInvoiceDeletable, formatInvoiceDeleteBlockedMessage, isInvoiceDeleteAdmin } from "@/lib/invoice-delete";

async function getSupabaseAndAuth() {
  const { cookies } = await import("next/headers");
  const { createServerClient } = await import("@supabase/ssr");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", userRes.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr || !membership?.org_id) {
    return {
      error: NextResponse.json(
        { error: memErr?.message || "Kamu belum punya organisasi aktif." },
        { status: 400 }
      ),
    };
  }

  return { supabase, orgId: String(membership.org_id), actorRole: String(membership.role || "staff") };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const auth = await getSupabaseAndAuth();
  if ("error" in auth && auth.error) return auth.error;

  const { supabase, orgId, actorRole } = auth;

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
