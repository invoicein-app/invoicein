export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const poId = String(id || "").trim();

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

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id,status")
    .eq("id", poId)
    .maybeSingle();

  if (!po) return NextResponse.json({ error: "PO tidak ditemukan." }, { status: 404 });
  if (po.status !== "draft")
    return NextResponse.json({ error: "Hanya DRAFT yang bisa di-SEND." }, { status: 400 });

  const { error } = await supabase
    .from("purchase_orders")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", poId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}