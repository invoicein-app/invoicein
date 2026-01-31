// ✅ CREATE NEW FILE
// invoiceku/app/api/quotations/delete/[id]/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // cookies() kadang ke-typing Promise
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  // 1) user gate (RLS)
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  const { data: userRes } = await supabaseUser.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2) pastikan user punya akses quotation ini (RLS)
  const { data: qGate, error: qGateErr } = await supabaseUser
    .from("quotations")
    .select("id,is_locked,invoice_id")
    .eq("id", id)
    .maybeSingle();

  if (qGateErr) return NextResponse.json({ error: qGateErr.message }, { status: 403 });
  if (!qGate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // blok delete kalau sudah locked / sudah linked invoice
  const locked = !!(qGate as any).is_locked;
  const invoiceId = String((qGate as any).invoice_id || "");
  if (locked || invoiceId) {
    return NextResponse.json(
      { error: "Quotation sudah locked / sudah linked ke invoice. Tidak bisa dihapus." },
      { status: 400 }
    );
  }

  // 3) admin service role (delete cascade manual)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // delete items dulu (kalau FK kamu sudah cascade, ini tetap aman)
  const { error: delItemsErr } = await admin
    .from("quotation_items")
    .delete()
    .eq("quotation_id", id);

  if (delItemsErr) return NextResponse.json({ error: delItemsErr.message }, { status: 400 });

  const { error: delQErr } = await admin
    .from("quotations")
    .delete()
    .eq("id", id);

  if (delQErr) return NextResponse.json({ error: delQErr.message }, { status: 400 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
