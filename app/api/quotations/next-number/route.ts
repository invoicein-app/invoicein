// =========================================
// 2B) API: Next Quotation Number (simple)
// app/api/quotations/next-number/route.ts
// =========================================
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function pad(n: number, len = 4) {
  return String(n).padStart(len, "0");
}

function yyyymm(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

// format: QUO-YYYYMM-0001
function makeNumber(prefix: string, ym: string, seq: number) {
  return `${prefix}-${ym}-${pad(seq, 4)}`;
}

export async function POST() {
  // cookies() kadang ke-typing Promise di beberapa versi Next — handle dua-duanya.
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  // user (RLS)
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
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // get org_id
  const { data: membership } = await supabaseUser
    .from("memberships")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const orgId = String((membership as any)?.org_id || "");
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  // admin (service role) buat hitung nomor terakhir
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const ym = yyyymm();
  const prefix = "QUO";

  // NOTE: ini sederhana (ada risiko race kalau 2 orang create bersamaan).
  // kalau nanti butuh anti-race, kita bikin RPC + advisory lock.
  const like = `${prefix}-${ym}-%`;

  const { data: rows, error } = await admin
    .from("quotations")
    .select("quotation_number")
    .eq("organization_id", orgId)
    .like("quotation_number", like)
    .order("quotation_number", { ascending: false })
    .limit(1);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let next = 1;
  const last = String((rows as any)?.[0]?.quotation_number || "");
  if (last) {
    const parts = last.split("-");
    const lastSeq = Number(parts[2]);
    if (Number.isFinite(lastSeq) && lastSeq > 0) next = lastSeq + 1;
  }

  const quotation_number = makeNumber(prefix, ym, next);
  return NextResponse.json({ quotation_number });
}