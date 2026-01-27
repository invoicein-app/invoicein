// app/api/org/profile/route.ts (FULL FILE)
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // org user dari memberships (org pertama)
  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memErr || !mem?.org_id) {
    return NextResponse.json({ error: "No organization found for this user." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Only allow updating fields we expect (biar aman)
  const payload = {
    name: String(body.name || ""),
    address: String(body.address || ""),
    phone: String(body.phone || ""),
    email: String(body.email || ""),
    bank_name: String(body.bank_name || ""),
    bank_account: String(body.bank_account || ""),
    bank_account_name: String(body.bank_account_name || ""),
    invoice_footer: String(body.invoice_footer || ""),
  };

  // update by org_id from membership (bukan dari body.id)
  const { error: updErr } = await supabase
    .from("organizations")
    .update(payload)
    .eq("id", mem.org_id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}