export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { resetMemberPasswordBodySchema } from "@/lib/validations/member";

export async function POST(req: NextRequest) {
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

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
  const meUser = userRes.user;
  if (!meUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedBody = await parseJsonBody(req, resetMemberPasswordBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const { memberId, newPassword } = parsedBody.data;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: target, error: targetErr } = await admin
    .from("memberships")
    .select("id, org_id, user_id, role")
    .eq("id", memberId)
    .maybeSingle();

  if (targetErr) return NextResponse.json({ error: targetErr.message }, { status: 400 });
  if (!target) return NextResponse.json({ error: "Member tidak ditemukan" }, { status: 404 });

  // gate admin org
  const { data: myMem, error: myMemErr } = await admin
    .from("memberships")
    .select("role")
    .eq("org_id", target.org_id)
    .eq("user_id", meUser.id)
    .maybeSingle();

  if (myMemErr) return NextResponse.json({ error: myMemErr.message }, { status: 403 });
  if (!myMem || myMem.role !== "admin") return NextResponse.json({ error: "Forbidden (admin only)" }, { status: 403 });

  // reset password di Supabase Auth
  const { error: upErr } = await admin.auth.admin.updateUserById(target.user_id, { password: newPassword });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return NextResponse.json({ ok: true }, { status: 200 });
}