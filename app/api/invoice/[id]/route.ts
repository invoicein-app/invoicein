import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!mem?.org_id) return NextResponse.json({ error: "No membership" }, { status: 403 });

  const orgId = mem.org_id as string;
  const role = String(mem.role || "staff");

  // AMAN: hanya admin yang boleh delete (UI kamu boleh staff disable, tapi API harus tegas)
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden (admin only)" }, { status: 403 });
  }

  // Cek payment dulu (kalau ada payment, block)
  const { count } = await supabase
    .from("invoice_payments")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", id);

  if ((count || 0) > 0) {
    return NextResponse.json({ error: "Tidak bisa delete: sudah ada pembayaran" }, { status: 400 });
  }

  // Ambil invoice_number buat log
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("id", id)
    .maybeSingle();

  // Delete items dulu (kalau FK tidak cascade)
  await supabase.from("invoice_items").delete().eq("invoice_id", id);

  // Delete invoice
  const { error: delErr } = await supabase.from("invoices").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: role,
    action: "invoice.delete",
    entity_type: "invoice",
    entity_id: id,
    summary: `Delete invoice ${inv?.invoice_number || id}`,
    meta: { invoice_id: id, invoice_number: inv?.invoice_number || null },
  });

  return NextResponse.json({ ok: true });
}
