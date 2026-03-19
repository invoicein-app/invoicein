/**
 * Billing admin inbox for feedback (Kritik & Masukan).
 * MVP: filter by status, only for org admin.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const csAny: any = cookies() as any;
  const cookieStore = csAny?.then ? await csAny : csAny;

  const status = String(req.nextUrl.searchParams.get("status") ?? "new").toLowerCase();
  const statusParam = status === "all" ? "all" : status;

  if (statusParam !== "all" && !["new", "read", "processed", "done"].includes(statusParam)) {
    return NextResponse.json({ error: "status tidak valid." }, { status: 400 });
  }

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

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // take first active admin membership
  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr || !mem?.org_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let query = supabase
    .from("feedback_submissions")
    .select("id, org_code, user_id, name, email, category, message, current_route, status, admin_note, reviewed_at, reviewed_by, created_at, updated_at")
    .eq("org_id", mem.org_id)
    .order("created_at", { ascending: false });

  if (statusParam !== "all") query = query.eq("status", statusParam);

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ feedback: rows || [] }, { status: 200 });
}

