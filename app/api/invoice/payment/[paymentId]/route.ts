// app/api/invoice/payment/[paymentId]/route.ts  (REPLACE FULL)
// FIX: cookies() harus await juga
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

async function sb() {
  const cookieStore = await cookies(); // ✅ await

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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await ctx.params;
  const supabase = await sb();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const amount = body?.amount !== undefined ? Number(body.amount) : undefined;
  const paid_at = body?.paid_at !== undefined ? String(body.paid_at) : undefined;
  const note =
    body?.note !== undefined ? (body.note ? String(body.note) : null) : undefined;

  const patch: any = {};

  if (amount !== undefined) {
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "amount invalid." }, { status: 400 });
    }
    patch.amount = amount;
  }

  if (paid_at !== undefined) {
    if (!paid_at) {
      return NextResponse.json({ error: "paid_at tidak boleh kosong." }, { status: 400 });
    }
    patch.paid_at = paid_at;
  }

  if (note !== undefined) patch.note = note;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Tidak ada field untuk diupdate." },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("invoice_payments").update(patch).eq("id", paymentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await ctx.params;
  const supabase = await sb();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("invoice_payments").delete().eq("id", paymentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}