// invoiceku/app/api/invoice/create/route.ts  (FULL REPLACE)

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";

type Item = { name: string; qty: number; price: number };

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampInt(n: number, min: number, max: number) {
  const x = Math.floor(num(n));
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

export async function POST(req: Request) {
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

  // auth
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = userRes.user;

  // body
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const {
    invoice_date,
    customer_id,
    customer_name,
    customer_phone,
    customer_address,
    note,

    // percent-only input (0..100)
    discount_value,
    tax_value,

    items,
  } = body as {
    invoice_date: string;
    customer_id?: string | null;
    customer_name: string;
    customer_phone?: string;
    customer_address?: string;
    note?: string;

    discount_value?: number; // percent
    tax_value?: number; // percent

    items: Item[];
  };

  // validate
  if (!String(customer_name || "").trim()) {
    return NextResponse.json({ error: "Customer name wajib diisi." }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Minimal 1 item." }, { status: 400 });
  }
  if (items.some((it) => !String(it?.name || "").trim())) {
    return NextResponse.json({ error: "Nama item tidak boleh kosong." }, { status: 400 });
  }

  // membership (org + role)
  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });
  if (!membership?.org_id) {
    return NextResponse.json({ error: "Kamu belum punya organisasi aktif." }, { status: 400 });
  }

  const orgId = String(membership.org_id);
  const actorRole = String((membership as any).role || "staff");

  const discPct = clampInt(discount_value ?? 0, 0, 100);
  const taxPct = clampInt(tax_value ?? 0, 0, 100);

  // Insert invoice
  // ✅ status diset ke "unpaid" supaya match enum invoice_status kamu
  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .insert({
      org_id: orgId,
      invoice_date,


      customer_id: customer_id || null,
      customer_name: customer_name,
      customer_phone: customer_phone || "",
      customer_address: customer_address || "",
      note: note || "",

      // ✅ percent-only (kalau kolom ini masih ada)
      discount_value: discPct,
      tax_value: taxPct,

      created_by: user.id,
      amount_paid: 0,
    })
    .select("id, invoice_number")
    .single();

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }

  // Insert items
  const payloadItems = items.map((it, idx) => ({
    invoice_id: inv.id,
    name: String(it.name || ""),
    qty: Math.max(0, Math.floor(num(it.qty))),
    price: Math.max(0, Math.floor(num(it.price))),
    sort_order: idx,
  }));

  const { error: itemErr } = await supabase.from("invoice_items").insert(payloadItems);
  if (itemErr) {
    // rollback best-effort
    await supabase.from("invoices").delete().eq("id", inv.id);
    return NextResponse.json({ error: itemErr.message }, { status: 400 });
  }

  // ✅ Activity log (jangan bikin request utama gagal kalau log gagal)
  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "invoice.create",
    entity_type: "invoice",
    entity_id: inv.id,
    summary: `Create invoice ${inv.invoice_number || inv.id}`,
    meta: {
      invoice_id: inv.id,
      invoice_number: inv.invoice_number ?? null,
      customer_name,
      items_count: payloadItems.length,
      status: "unpaid",
      discount_percent: discPct,
      tax_percent: taxPct,
    },
  });

  return NextResponse.json(
    { id: inv.id, invoice_number: inv.invoice_number ?? null },
    { status: 200 }
  );
}