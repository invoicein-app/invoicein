export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { asText, getAuthAndOrg, getSupabaseFromCookies, num } from "@/lib/api-auth-org";
import { requireCanWrite } from "@/lib/subscription";
import {
  calcRemaining,
  deriveManualLedgerStatus,
  isPartySourceType,
  labelManualLedgerStatus,
  toYmd,
  type PartySourceType,
} from "@/lib/manual-ledger";

type Ctx = { params: Promise<{ id: string }> };

function normalizeDateOrNull(v: unknown) {
  const s = asText(v);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function withStatus(row: Record<string, unknown>) {
  const status = deriveManualLedgerStatus({
    totalAmount: Number(row.total_amount || 0),
    paidAmount: Number(row.paid_amount || 0),
    dueDate: normalizeDateOrNull(row.due_date),
    today: toYmd(),
  });
  return {
    ...row,
    remaining_amount: calcRemaining(Number(row.total_amount || 0), Number(row.paid_amount || 0)),
    ledger_status: status,
    ledger_status_label: labelManualLedgerStatus(status),
  };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { orgId } = auth;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { data: before, error: beforeErr } = await supabase
    .from("manual_ledger_entries")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (beforeErr) return NextResponse.json({ error: beforeErr.message }, { status: 400 });
  if (!before) return NextResponse.json({ error: "Data tidak ditemukan." }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.entry_date !== undefined) {
    const d = normalizeDateOrNull(body.entry_date);
    if (!d) return NextResponse.json({ error: "Tanggal wajib diisi." }, { status: 400 });
    patch.entry_date = d;
  }
  if (body.description !== undefined) {
    const d = asText(body.description);
    if (!d) return NextResponse.json({ error: "Deskripsi wajib diisi." }, { status: 400 });
    patch.description = d;
  }
  if (body.total_amount !== undefined) {
    const t = Math.max(0, num(body.total_amount));
    if (t <= 0) return NextResponse.json({ error: "Nominal total harus > 0." }, { status: 400 });
    patch.total_amount = t;
  }
  if (body.paid_amount !== undefined) {
    patch.paid_amount = Math.max(0, num(body.paid_amount));
  }
  if (body.due_date !== undefined) patch.due_date = normalizeDateOrNull(body.due_date);
  if (body.notes !== undefined) patch.notes = asText(body.notes) || null;

  let nextPartySourceType = (patch.party_source_type ?? before.party_source_type) as PartySourceType;
  if (body.party_source_type !== undefined) {
    const x = asText(body.party_source_type);
    if (!isPartySourceType(x)) {
      return NextResponse.json({ error: "Sumber pihak tidak valid." }, { status: 400 });
    }
    nextPartySourceType = x;
    patch.party_source_type = x;
  }

  const nextCustomerId = body.customer_id !== undefined ? asText(body.customer_id) || null : before.customer_id;
  const nextVendorId = body.vendor_id !== undefined ? asText(body.vendor_id) || null : before.vendor_id;
  let nextPartyName = body.party_name !== undefined ? asText(body.party_name) : String(before.party_name || "");

  if (nextPartySourceType === "customer") {
    if (!nextCustomerId) return NextResponse.json({ error: "Customer wajib dipilih." }, { status: 400 });
    const { data: cust, error: custErr } = await supabase
      .from("customers")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("id", nextCustomerId)
      .maybeSingle();
    if (custErr) return NextResponse.json({ error: custErr.message }, { status: 400 });
    if (!cust) return NextResponse.json({ error: "Customer tidak ditemukan." }, { status: 404 });
    nextPartyName = String(cust.name || "").trim();
  } else if (nextPartySourceType === "vendor") {
    if (!nextVendorId) return NextResponse.json({ error: "Vendor wajib dipilih." }, { status: 400 });
    const { data: vendor, error: vendorErr } = await supabase
      .from("vendors")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("id", nextVendorId)
      .maybeSingle();
    if (vendorErr) return NextResponse.json({ error: vendorErr.message }, { status: 400 });
    if (!vendor) return NextResponse.json({ error: "Vendor tidak ditemukan." }, { status: 404 });
    nextPartyName = String(vendor.name || "").trim();
  }

  if (!nextPartyName) return NextResponse.json({ error: "Nama pihak wajib diisi." }, { status: 400 });

  patch.customer_id = nextPartySourceType === "customer" ? nextCustomerId : null;
  patch.vendor_id = nextPartySourceType === "vendor" ? nextVendorId : null;
  patch.party_name = nextPartyName;

  const nextTotal = Number(patch.total_amount ?? before.total_amount ?? 0);
  const nextPaid = Number(patch.paid_amount ?? before.paid_amount ?? 0);
  if (nextPaid > nextTotal) {
    return NextResponse.json({ error: "Jumlah dibayar tidak boleh melebihi total." }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("manual_ledger_entries")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, row: withStatus(row) });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { orgId } = auth;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const { error } = await supabase.from("manual_ledger_entries").delete().eq("org_id", orgId).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
