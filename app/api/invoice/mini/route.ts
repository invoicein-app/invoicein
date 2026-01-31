// ✅ FULL REPLACE FILE
// invoiceku/app/api/invoice/mini/route.ts
//
// GET /api/invoice/mini?id=<invoice_uuid>
// returns: { id, invoice_number }

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = String(url.searchParams.get("id") || "").trim();

  if (!id) {
    return NextResponse.json({ error: "Missing query param: id" }, { status: 400 });
  }

  // cookies() di Next kadang Promise / kadang bukan
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  // auth (biar lolos RLS)
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // optional: membership check (kalau mau super aman)
  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("org_id,is_active")
    .eq("user_id", userRes.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });
  if (!mem?.org_id) return NextResponse.json({ error: "No active org" }, { status: 400 });

  // ambil invoice mini
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("id", id)
    .eq("org_id", mem.org_id) // penting biar gak bocor lintas org
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json(
    { id: data.id, invoice_number: data.invoice_number ?? null },
    { status: 200 }
  );
}
