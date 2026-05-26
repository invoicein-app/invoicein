import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function getSupabaseFromCookies() {
  const cookieStore = await cookies();
  return createServerClient(
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
}

export async function getAuthAndOrg(supabase: Awaited<ReturnType<typeof getSupabaseFromCookies>>) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = userRes.user;
  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return { error: NextResponse.json({ error: memErr.message }, { status: 400 }) };
  }
  if (!membership?.org_id) {
    return { error: NextResponse.json({ error: "Kamu belum punya organisasi aktif." }, { status: 400 }) };
  }

  return {
    user,
    orgId: String(membership.org_id),
    actorRole: String(membership.role || "staff"),
  };
}

export function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function asText(v: unknown) {
  return String(v ?? "").trim();
}
