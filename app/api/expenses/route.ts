export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/log-activity";
import { requireCanWrite } from "@/lib/subscription";
import {
  EXPENSE_CATEGORIES,
  expensePaymentMethodFilterOrClause,
  isExpenseCategory,
  parseExpensePaymentMethodFilter,
  parseExpensePaymentMethodInput,
} from "@/lib/expense-categories";
import { asText, getAuthAndOrg, getSupabaseFromCookies, num } from "@/lib/api-auth-org";

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { orgId } = auth;

  const { searchParams } = new URL(req.url);
  const month = asText(searchParams.get("month"));
  const category = asText(searchParams.get("category"));
  const paymentStatus = asText(searchParams.get("payment_status"));
  const paymentMethod = parseExpensePaymentMethodFilter(searchParams.get("payment_method"));
  const q = asText(searchParams.get("q"));

  let query = supabase
    .from("expenses")
    .select("*")
    .eq("org_id", orgId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const start = `${month}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${month}-${String(lastDay).padStart(2, "0")}`;
    query = query.gte("expense_date", start).lte("expense_date", end);
  }

  if (category) query = query.eq("category", category);
  if (paymentStatus === "paid" || paymentStatus === "unpaid") {
    query = query.eq("payment_status", paymentStatus);
  }
  if (paymentMethod) {
    query = query.or(expensePaymentMethodFilterOrClause(paymentMethod));
  }
  if (q) {
    query = query.or(`description.ilike.%${q}%,notes.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, expenses: data || [], categories: EXPENSE_CATEGORIES });
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { user, orgId, actorRole } = auth;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const expense_date = asText(body.expense_date);
  const category = asText(body.category);
  const description = asText(body.description);
  const amount = Math.max(0, num(body.amount));
  const payment_status = body.payment_status === "unpaid" ? "unpaid" : "paid";
  const payment_method = parseExpensePaymentMethodInput(body.payment_method);
  const notes = asText(body.notes) || null;

  if (!expense_date) return NextResponse.json({ error: "Tanggal wajib diisi." }, { status: 400 });
  if (!category || !isExpenseCategory(category)) {
    return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });
  }
  if (!description) return NextResponse.json({ error: "Deskripsi wajib diisi." }, { status: 400 });
  if (amount <= 0) return NextResponse.json({ error: "Nominal harus lebih dari 0." }, { status: 400 });

  const { data: row, error } = await supabase
    .from("expenses")
    .insert({
      org_id: orgId,
      expense_date,
      category,
      description,
      amount,
      payment_status,
      payment_method,
      notes,
      recurring_template_id: null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "expense.create",
    entity_type: "expense",
    entity_id: row.id,
    summary: `Catat pengeluaran ${description} (${amount})`,
    meta: row,
  });

  return NextResponse.json({ ok: true, expense: row });
}
