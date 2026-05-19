// POST { ids: string[] } -> { labels: Record<userId, displayName> } using service role (optional)
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient as createSSRClient } from "@supabase/ssr";

function isUuid(v: string): v is string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabaseUser = createSSRClient(
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

  const { data: userRes } = await supabaseUser.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rawIds: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
  const ids: string[] = [
    ...new Set(rawIds.map((x) => String(x)).filter((s) => isUuid(s))),
  ].slice(0, 80);

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const labels: Record<string, string> = {};
    return NextResponse.json({ labels }, { status: 200 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const labels: Record<string, string> = {};

  await Promise.all(
    ids.map(async (id) => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(id);
        if (error || !data?.user) return;
        const u = data.user;
        const meta = u.user_metadata as Record<string, unknown> | undefined;
        const name =
          (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
          (typeof meta?.name === "string" && meta.name.trim()) ||
          (u.email ? u.email.split("@")[0] : "") ||
          "—";
        labels[id] = name;
      } catch {
        /* skip */
      }
    })
  );

  return NextResponse.json({ labels }, { status: 200 });
}
