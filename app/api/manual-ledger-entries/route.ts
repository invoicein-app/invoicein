export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { asText, getAuthAndOrg, getSupabaseFromCookies, num } from "@/lib/api-auth-org";
import { requireCanWrite } from "@/lib/subscription";
import {
  calcRemaining,
  deriveManualLedgerStatus,
  isManualEntryType,
  isPartySourceType,
  labelManualLedgerStatus,
  toYmd,
  type ManualEntryType,
  type PartySourceType,
} from "@/lib/manual-ledger";

type ManualLedgerRow = {
  id: string;
  entry_type: ManualEntryType;
  entry_date: string;
  party_source_type: PartySourceType;
  customer_id: string | null;
  vendor_id: string | null;
  party_name: string;
  description: string;
  total_amount: number;
  paid_amount: number;
  due_date: string | null;
  notes: string | null;
};

function normalizeDateOrNull(v: unknown) {
  const s = asText(v);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function statusFromRow(row: ManualLedgerRow, today: string) {
  const status = deriveManualLedgerStatus({
    totalAmount: Number(row.total_amount || 0),
    paidAmount: Number(row.paid_amount || 0),
    dueDate: row.due_date,
    today,
  });
  const remaining = calcRemaining(Number(row.total_amount || 0), Number(row.paid_amount || 0));
  return {
    ...row,
    remaining_amount: remaining,
    ledger_status: status,
    ledger_status_label: labelManualLedgerStatus(status),
  };
}

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { orgId } = auth;

  const { searchParams } = new URL(req.url);
  const type = asText(searchParams.get("type"));
  const q = asText(searchParams.get("q")).toLowerCase();
  const status = asText(searchParams.get("status")).toLowerCase();
  const overdueOnly = asText(searchParams.get("overdue")) === "1";
  const month = asText(searchParams.get("month"));

  let query = supabase
    .from("manual_ledger_entries")
    .select("*")
    .eq("org_id", orgId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (isManualEntryType(type)) query = query.eq("entry_type", type);
  if (q) query = query.or(`party_name.ilike.%${q}%,description.ilike.%${q}%,notes.ilike.%${q}%`);
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const start = `${month}-01`;
    const last = new Date(y, m, 0).getDate();
    const end = `${month}-${String(last).padStart(2, "0")}`;
    query = query.gte("entry_date", start).lte("entry_date", end);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const today = toYmd();
  let rows = ((data || []) as ManualLedgerRow[]).map((r) => statusFromRow(r, today));
  if (!status || status === "all") {
    rows = rows.filter((r) => r.remaining_amount > 0);
  } else if (status === "belum_dibayar") {
    rows = rows.filter((r) => r.ledger_status === "BELUM_DIBAYAR");
  } else if (status === "sebagian") {
    rows = rows.filter((r) => r.ledger_status === "SEBAGIAN");
  } else if (status === "lunas") {
    rows = rows.filter((r) => r.ledger_status === "LUNAS");
  } else if (status === "lewat_jatuh_tempo") {
    rows = rows.filter((r) => r.ledger_status === "LEWAT_JATUH_TEMPO");
  }

  if (overdueOnly) rows = rows.filter((r) => r.ledger_status === "LEWAT_JATUH_TEMPO");

  const summary = {
    total_amount: rows.reduce((a, r) => a + Number(r.total_amount || 0), 0),
    total_paid: rows.reduce((a, r) => a + Number(r.paid_amount || 0), 0),
    total_remaining: rows.reduce((a, r) => a + Number(r.remaining_amount || 0), 0),
    count: rows.length,
    overdue_count: rows.filter((r) => r.ledger_status === "LEWAT_JATUH_TEMPO").length,
  };

  return NextResponse.json({ ok: true, rows, summary, today });
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { orgId } = auth;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const entry_type = asText(body.entry_type);
  const party_source_type = asText(body.party_source_type || "other");
  const entry_date = normalizeDateOrNull(body.entry_date);
  const due_date = normalizeDateOrNull(body.due_date);
  const description = asText(body.description);
  const total_amount = Math.max(0, num(body.total_amount));
  const paid_amount = Math.max(0, num(body.paid_amount));
  const notes = asText(body.notes) || null;
  const customer_id = asText(body.customer_id) || null;
  const vendor_id = asText(body.vendor_id) || null;
  let party_name = asText(body.party_name);

  if (!isManualEntryType(entry_type)) {
    return NextResponse.json({ error: "Jenis entri tidak valid." }, { status: 400 });
  }
  if (!isPartySourceType(party_source_type)) {
    return NextResponse.json({ error: "Sumber pihak tidak valid." }, { status: 400 });
  }
  if (!entry_date) return NextResponse.json({ error: "Tanggal wajib diisi." }, { status: 400 });
  if (!description) return NextResponse.json({ error: "Deskripsi wajib diisi." }, { status: 400 });
  if (total_amount <= 0) return NextResponse.json({ error: "Nominal total harus > 0." }, { status: 400 });
  if (paid_amount > total_amount) {
    return NextResponse.json({ error: "Jumlah dibayar tidak boleh melebihi total." }, { status: 400 });
  }

  if (party_source_type === "customer") {
    if (!customer_id) return NextResponse.json({ error: "Customer wajib dipilih." }, { status: 400 });
    const { data: cust, error: custErr } = await supabase
      .from("customers")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("id", customer_id)
      .maybeSingle();
    if (custErr) return NextResponse.json({ error: custErr.message }, { status: 400 });
    if (!cust) return NextResponse.json({ error: "Customer tidak ditemukan." }, { status: 404 });
    party_name = String(cust.name || "").trim();
  } else if (party_source_type === "vendor") {
    if (!vendor_id) return NextResponse.json({ error: "Vendor wajib dipilih." }, { status: 400 });
    const { data: vendor, error: vendorErr } = await supabase
      .from("vendors")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("id", vendor_id)
      .maybeSingle();
    if (vendorErr) return NextResponse.json({ error: vendorErr.message }, { status: 400 });
    if (!vendor) return NextResponse.json({ error: "Vendor tidak ditemukan." }, { status: 404 });
    party_name = String(vendor.name || "").trim();
  }

  if (!party_name) {
    return NextResponse.json({ error: "Nama pihak wajib diisi." }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("manual_ledger_entries")
    .insert({
      org_id: orgId,
      entry_type,
      entry_date,
      party_source_type,
      customer_id: party_source_type === "customer" ? customer_id : null,
      vendor_id: party_source_type === "vendor" ? vendor_id : null,
      party_name,
      description,
      total_amount,
      paid_amount,
      due_date,
      notes,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, row: statusFromRow(row as ManualLedgerRow, toYmd()) });
}
