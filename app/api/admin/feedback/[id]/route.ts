/**
 * Update feedback status/admin note.
 * Only org admin can update their org's feedback.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csAny: any = cookies() as any;
  const cookieStore = csAny?.then ? await csAny : csAny;

  const body = await req.json().catch(() => ({}));
  const id = (await params).id?.trim();
  if (!id) return NextResponse.json({ error: "ID wajib." }, { status: 400 });

  const nextStatus = String(body?.status ?? "").toLowerCase();
  if (!["new", "read", "processed", "done"].includes(nextStatus)) {
    return NextResponse.json({ error: "status tidak valid." }, { status: 400 });
  }

  const adminNote = body?.admin_note != null ? String(body.admin_note).trim() : null;

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

  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr || !mem?.org_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: row, error: loadErr } = await supabase
    .from("feedback_submissions")
    .select("id, org_id")
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !row) return NextResponse.json({ error: "Feedback tidak ditemukan." }, { status: 404 });
  if (row.org_id !== mem.org_id) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { error: upErr } = await supabase
    .from("feedback_submissions")
    .update({
      status: nextStatus,
      admin_note: adminNote || null,
      reviewed_at: nextStatus === "read" || nextStatus === "processed" || nextStatus === "done" ? new Date().toISOString() : null,
      reviewed_by: nextStatus === "read" || nextStatus === "processed" || nextStatus === "done" ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 200 });
}

