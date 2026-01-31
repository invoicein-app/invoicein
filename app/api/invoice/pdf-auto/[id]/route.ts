// app/api/invoice/pdf-auto/[id]/route.ts
// Router endpoint: pilih template aktif organisasi lalu redirect ke endpoint PDF yang sesuai

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function normalizeKey(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // cookies() kadang ke-typing Promise di beberapa versi Next — handle dua-duanya
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  const url = new URL(req.url);
  const download = url.searchParams.get("download"); // keep as-is

  // 1) User client (RLS gate) — pastiin user login & invoice memang boleh diakses
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

  // Gate invoice (RLS)
  const { data: invGate, error: invGateErr } = await supabaseUser
    .from("invoices")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (invGateErr) return NextResponse.json({ error: invGateErr.message }, { status: 403 });
  if (!invGate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 2) Admin client — ambil org_id + invoice_settings (service role)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: inv, error: invErr } = await admin
    .from("invoices")
    .select("id, org_id")
    .eq("id", id)
    .maybeSingle();

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 });
  if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // default
  let templateKey = "clean";

  if (inv.org_id) {
    const { data: settings, error: setErr } = await admin
      .from("invoice_settings")
      .select("active_template_key")
      .eq("organization_id", inv.org_id)
      .maybeSingle();

    if (!setErr && settings?.active_template_key) {
      templateKey = normalizeKey(settings.active_template_key);
    }
  }

  // 3) Map template -> endpoint (file masing-masing)
  const map: Record<string, string> = {
    clean: `/api/invoice/pdf/${id}`,
    dotmatrix: `/api/invoice/pdf-dotmatrix/${id}`,

    // nanti kalau kamu bikin file terpisah, tinggal ganti mapping ini:
    // template_1: `/api/invoice/pdf-template-1/${id}`,
    // template_2: `/api/invoice/pdf-template-2/${id}`,
    // template_3: `/api/invoice/pdf-template-3/${id}`,
    // template_4: `/api/invoice/pdf-template-4/${id}`,
    // template_5: `/api/invoice/pdf-template-5/${id}`,
  };

  const targetPath = map[templateKey] ?? map.clean;

  const targetUrl = new URL(targetPath, url.origin);
  if (download != null && download !== "") {
    targetUrl.searchParams.set("download", download);
  }

  // Redirect biar browser lanjut ke endpoint final (cookies tetap kebawa)
  return NextResponse.redirect(targetUrl, 307);
}