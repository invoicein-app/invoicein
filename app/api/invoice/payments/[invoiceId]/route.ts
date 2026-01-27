// app/api/invoice/payments/[invoiceId]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// GET: list payments by invoice_id
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
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

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);

  // ambil payments
  const { data, error } = await supabase
    .from("invoice_payments")
    .select("id, invoice_id, paid_at, amount, note, created_at")
    .eq("invoice_id", invoiceId)
    .order("paid_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return json({ error: error.message }, 400);

  return json({ payments: data || [] }, 200);
}

// POST: create payment for invoice_id
export async function POST(
  req: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
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

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
  const user = userRes.user;

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const paid_at = String(body.paid_at || "").slice(0, 10);
  const amount = Math.floor(Math.max(0, num(body.amount)));
  const note = String(body.note || "");

  if (!paid_at) return json({ error: "paid_at wajib diisi" }, 400);
  if (!amount || amount <= 0) return json({ error: "amount harus > 0" }, 400);

  // insert payment
  const { data: inserted, error: insErr } = await supabase
    .from("invoice_payments")
    .insert({
      invoice_id: invoiceId,
      paid_at,
      amount,
      note,
      // kalau tabel payments kamu ada created_by, aktifin ini:
      // created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr) return json({ error: insErr.message }, 400);

  // OPTIONAL: kalau kamu butuh update invoices.amount_paid otomatis dari payments,
  // seharusnya ini pakai trigger di DB. Kalau belum ada trigger, bilang ya, nanti aku bikinin.

  return json({ ok: true, id: inserted?.id }, 200);
}