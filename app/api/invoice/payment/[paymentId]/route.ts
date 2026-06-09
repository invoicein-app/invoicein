// app/api/invoice/payment/[paymentId]/route.ts  (REPLACE FULL)
// FIX: cookies() harus await juga
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireCanWrite } from "@/lib/subscription";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { updateInvoicePaymentBodySchema } from "@/lib/validations/payment";

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

  const parsedBody = await parseJsonBody(req, updateInvoicePaymentBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const { data: payRow } = await supabase
    .from("invoice_payments")
    .select("invoice_id")
    .eq("id", paymentId)
    .maybeSingle();
  const invoiceId = (payRow as any)?.invoice_id;
  if (invoiceId) {
    const { data: invRow } = await supabase
      .from("invoices")
      .select("org_id")
      .eq("id", invoiceId)
      .maybeSingle();
    const orgId = (invRow as any)?.org_id;
    if (orgId) {
      const subBlock = await requireCanWrite(supabase, orgId);
      if (subBlock) return subBlock;
    }
  }

  const patch: Record<string, unknown> = {};
  if (body.amount !== undefined) patch.amount = body.amount;
  if (body.paid_at !== undefined) patch.paid_at = body.paid_at;
  if (body.note !== undefined) patch.note = body.note;

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

  const { data: payRow } = await supabase
    .from("invoice_payments")
    .select("invoice_id")
    .eq("id", paymentId)
    .maybeSingle();
  const invoiceId = (payRow as any)?.invoice_id;
  if (invoiceId) {
    const { data: invRow } = await supabase
      .from("invoices")
      .select("org_id")
      .eq("id", invoiceId)
      .maybeSingle();
    const orgId = (invRow as any)?.org_id;
    if (orgId) {
      const subBlock = await requireCanWrite(supabase, orgId);
      if (subBlock) return subBlock;
    }
  }

  const { error } = await supabase.from("invoice_payments").delete().eq("id", paymentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}