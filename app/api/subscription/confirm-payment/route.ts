/**
 * User submits payment confirmation for subscription renewal.
 * Requires auth; org_id must belong to user's membership. Inserts into payment_confirmations.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const csAny: any = cookies() as any;
  const cookieStore = csAny?.then ? await csAny : csAny;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: any }[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
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

  const body = await req.json().catch(() => ({}));
  const orgId = String(body?.org_id ?? "").trim();
  if (!orgId) return NextResponse.json({ error: "org_id wajib diisi." }, { status: 400 });

  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle();

  if (!mem?.org_id) return NextResponse.json({ error: "Organisasi tidak ditemukan atau tidak ada akses." }, { status: 403 });

  const targetPackage = String(body?.target_package ?? "").toLowerCase();
  if (targetPackage !== "basic" && targetPackage !== "standard") {
    return NextResponse.json({ error: "Paket target harus basic atau standard." }, { status: 400 });
  }

  const senderAccountName = String(body?.sender_account_name ?? "").trim();
  const senderBank = String(body?.sender_bank ?? "").trim();
  const senderAccountNumber = String(body?.sender_account_number ?? "").trim();
  const transferAmount = String(body?.transfer_amount ?? "").trim();
  const transferDate = String(body?.transfer_date ?? "").trim();

  if (!senderAccountName) return NextResponse.json({ error: "Nama rekening pengirim wajib diisi." }, { status: 400 });
  if (!senderBank) return NextResponse.json({ error: "Bank pengirim wajib diisi." }, { status: 400 });
  if (!senderAccountNumber) return NextResponse.json({ error: "Nomor rekening pengirim wajib diisi." }, { status: 400 });
  if (!transferAmount) return NextResponse.json({ error: "Nominal transfer wajib diisi." }, { status: 400 });
  if (!transferDate) return NextResponse.json({ error: "Tanggal transfer wajib diisi." }, { status: 400 });

  const note = body?.note != null ? String(body.note).trim() : null;

  const { data: row, error } = await supabase
    .from("payment_confirmations")
    .insert({
      org_id: orgId,
      user_id: user.id,
      target_package: targetPackage,
      sender_account_name: senderAccountName,
      sender_bank: senderBank,
      sender_account_number: senderAccountNumber,
      transfer_amount: transferAmount,
      transfer_date: transferDate,
      note: note || null,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .select("id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: row.id, created_at: row.created_at }, { status: 200 });
}
