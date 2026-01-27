// invoiceku/app/dashboard/page.tsx  (FULL REPLACE)
//
// Dashboard v1 (lebih "berguna" + gak kopong):
// - KPI cards: Outstanding (UNPAID/PARTIAL), Paid bulan ini, Paid bulan lalu, Total invoice
// - "Butuh perhatian": 8 invoice unpaid/partial paling lama (clickable)
// - Mini chart: Omset Paid 6 bulan terakhir (bar chart pakai div, tanpa library)
// - Quick stats: jumlah customer + products
//
// NOTE penting biar hitungan muncul:
// ✅ semua query di-filter by org_id
// ✅ status bayar dihitung dari grandTotal vs amount_paid (bukan cuma kolom status)
// ✅ discount_value & tax_value dianggap persen (0-100)

import { supabaseServer } from "@/lib/supabase/server";
import { rupiah } from "@/lib/money";

function clampPercent(v: any) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthKey(dt: Date) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(base: Date, delta: number) {
  const d = new Date(base);
  d.setMonth(d.getMonth() + delta);
  return d;
}

export default async function DashboardPage() {
  const supabase = await supabaseServer();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;

  if (!user) {
    return (
      <div style={{ padding: 18, maxWidth: 1050, margin: "0 auto" }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <p style={{ marginTop: 6, color: "#666" }}>Kamu belum login.</p>
      </div>
    );
  }

  // org + role
  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, organizations:organizations(name)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const orgId = (mem as any)?.org_id as string | undefined;
  const orgName = (mem as any)?.organizations?.name || "";
  const role = (mem as any)?.role || "-";

  if (!orgId) {
    return (
      <div style={{ padding: 18, maxWidth: 1050, margin: "0 auto" }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <p style={{ marginTop: 6, color: "#666" }}>
          Organisasi belum ter-set. (Belum ada membership aktif)
        </p>
        {memErr?.message ? (
          <p style={{ marginTop: 10, color: "#b00" }}>{memErr.message}</p>
        ) : null}
      </div>
    );
  }

  // Ambil invoices + items (1 query) — penting: filter org_id
  const { data: invRows, error: invErr } = await supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      invoice_date,
      status,
      customer_name,
      discount_value,
      tax_value,
      amount_paid,
      org_id,
      invoice_items(qty,price)
    `
    )
    .eq("org_id", orgId)
    .order("invoice_date", { ascending: true });

  // Quick counts (biar dashboard gak kosong)
  const [{ count: customerCount }, { count: productCount }] = await Promise.all([
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
  ]);

  // kalau invoices gagal kebaca, tetap render dashboard + error
  const invoices = (invRows || []) as any[];

  // Helper: hitung total invoice
  function calcTotals(inv: any) {
    const items = (inv?.invoice_items || []) as any[];
    const subtotal = items.reduce(
      (a, it) => a + Number(it?.qty || 0) * Number(it?.price || 0),
      0
    );

    const discPct = clampPercent(inv?.discount_value);
    const taxPct = clampPercent(inv?.tax_value);

    const discount = Math.max(0, subtotal * (discPct / 100));
    const afterDisc = Math.max(0, subtotal - discount);
    const tax = Math.max(0, afterDisc * (taxPct / 100));
    const grandTotal = Math.max(0, afterDisc + tax);

    const paid = Math.max(0, Number(inv?.amount_paid || 0));
    const remaining = Math.max(0, grandTotal - paid);

    let payState: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";
    if (grandTotal > 0 && remaining <= 0) payState = "PAID";
    else if (paid > 0 && remaining > 0) payState = "PARTIAL";

    return { subtotal, discount, tax, grandTotal, paid, remaining, payState };
  }

  // Ringkas KPI
  let outstandingCount = 0;
  let outstandingSum = 0;

  let paidCount = 0;
  let paidSumThisMonth = 0;
  let paidSumLastMonth = 0;

  const now = new Date();
  const thisMonthKey = monthKey(now);
  const lastMonthKey = monthKey(addMonths(now, -1));

  // byMonth (paid) 6 bulan terakhir
  const monthKeys6 = Array.from({ length: 6 }, (_, i) => monthKey(addMonths(now, -(5 - i))));
  const paidByMonth = new Map<string, number>();
  monthKeys6.forEach((k) => paidByMonth.set(k, 0));

  // list attention candidates
  const attention: Array<{
    id: string;
    invoice_number: string | null;
    invoice_date: string | null;
    customer_name: string | null;
    remaining: number;
    grandTotal: number;
    payState: "UNPAID" | "PARTIAL" | "PAID";
  }> = [];

  for (const inv of invoices) {
    const t = calcTotals(inv);
    const dt = inv?.invoice_date ? new Date(inv.invoice_date) : null;
    const mk = dt ? monthKey(dt) : "";

    if (t.payState !== "PAID") {
      outstandingCount += 1;
      outstandingSum += t.remaining;

      attention.push({
        id: String(inv.id),
        invoice_number: inv.invoice_number ?? null,
        invoice_date: inv.invoice_date ?? null,
        customer_name: inv.customer_name ?? null,
        remaining: t.remaining,
        grandTotal: t.grandTotal,
        payState: t.payState,
      });
    } else {
      paidCount += 1;

      if (mk === thisMonthKey) paidSumThisMonth += t.grandTotal;
      if (mk === lastMonthKey) paidSumLastMonth += t.grandTotal;

      if (paidByMonth.has(mk)) {
        paidByMonth.set(mk, (paidByMonth.get(mk) || 0) + t.grandTotal);
      }
    }
  }

  // Sort attention: paling lama dulu
  attention.sort((a, b) => {
    const da = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
    const db = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
    return da - db;
  });

  const attentionTop = attention.slice(0, 8);

  const monthBars = monthKeys6.map((k) => ({ month: k, value: paidByMonth.get(k) || 0 }));
  const maxBar = Math.max(1, ...monthBars.map((x) => x.value));

  return (
    <div style={{ padding: 18, maxWidth: 1050, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ marginTop: 6, color: "#666" }}>
            Organisasi: {orgName || "-"} • Role: {role}
          </p>
          {invErr?.message ? (
            <p style={{ marginTop: 8, color: "#b00" }}>
              Error baca invoices: {invErr.message}
            </p>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/invoice/new" style={btnPrimary()}>+ Buat Invoice</a>
          <a href="/invoice" style={btn()}>Daftar Invoice</a>
          <a href="/delivery-notes" style={btn()}>Surat Jalan</a>
          <a href="/products" style={btn()}>Barang</a>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
        <div style={card()}>
          <div style={kpiLabel()}>Outstanding (UNPAID/PARTIAL)</div>
          <div style={kpiValue()}>{outstandingCount}</div>
          <div style={kpiSub()}>Sisa tagihan: <b>{rupiah(outstandingSum)}</b></div>
        </div>

        <div style={card()}>
          <div style={kpiLabel()}>Paid Bulan Ini</div>
          <div style={kpiValue()}>{rupiah(paidSumThisMonth)}</div>
          <div style={kpiSub()}>({thisMonthKey})</div>
        </div>

        <div style={card()}>
          <div style={kpiLabel()}>Paid Bulan Lalu</div>
          <div style={kpiValue()}>{rupiah(paidSumLastMonth)}</div>
          <div style={kpiSub()}>({lastMonthKey})</div>
        </div>

        <div style={card()}>
          <div style={kpiLabel()}>Total Invoice</div>
          <div style={kpiValue()}>{invoices.length}</div>
          <div style={kpiSub()}>
            Paid: <b>{paidCount}</b> • Customers: <b>{customerCount ?? 0}</b> • Products: <b>{productCount ?? 0}</b>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
        {/* Attention list */}
        <div style={card()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Butuh Perhatian</h3>
            <span style={{ color: "#666", fontSize: 13 }}>
              UNPAID/PARTIAL paling lama (klik untuk buka)
            </span>
          </div>

          <div style={{ marginTop: 10 }}>
            {attentionTop.length === 0 ? (
              <p style={{ color: "#666", margin: 0 }}>Aman. Tidak ada invoice outstanding 🎉</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {attentionTop.map((x) => (
                  <a key={x.id} href={`/invoice/${x.id}`} style={rowLink()}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>
                          {x.invoice_number ? `Invoice ${x.invoice_number}` : `Invoice ${x.id.slice(0, 8)}…`}
                          <span style={{ marginLeft: 8, ...pill(x.payState) }}>{x.payState}</span>
                        </div>
                        <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                          {x.invoice_date || "-"} • {x.customer_name || "-"}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800 }}>{rupiah(x.remaining)}</div>
                        <div style={{ color: "#666", fontSize: 12 }}>dari {rupiah(x.grandTotal)}</div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 10 }}>
            <a href="/invoice" style={{ ...btn(), display: "inline-block" }}>Lihat semua invoice →</a>
          </div>
        </div>

        {/* Mini chart */}
        <div style={card()}>
          <h3 style={{ margin: 0 }}>Omset Paid (6 Bulan)</h3>
          <p style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
            Bar chart sederhana (tanpa library)
          </p>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {monthBars.map((m) => {
              const w = Math.max(2, Math.round((m.value / maxBar) * 100));
              return (
                <div key={m.month} style={{ display: "grid", gridTemplateColumns: "76px 1fr", gap: 10, alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: "#666" }}>{m.month}</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ height: 10, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${w}%`, height: "100%", background: "#111" }} />
                    </div>
                    <div style={{ fontSize: 12 }}>{rupiah(m.value)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 10 }}>
            <div style={{ color: "#666", fontSize: 12 }}>Tip:</div>
            <div style={{ color: "#333", fontSize: 13 }}>
              nanti kalau mau “lebih cakep”, kita bisa ganti ini jadi chart beneran (Recharts),
              tapi versi ini udah cukup buat deploy & validasi.
            </div>
          </div>
        </div>
      </div>

      {/* Shortcuts */}
      <div style={{ marginTop: 12, ...card() }}>
        <h3 style={{ margin: 0 }}>Shortcut</h3>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <a href="/invoice/new" style={btnPrimary()}>+ Buat Invoice Baru</a>
          <a href="/invoice" style={btn()}>Lihat Daftar Invoice</a>
          <a href="/delivery-notes" style={btn()}>Lihat Surat Jalan</a>
          <a href="/products" style={btn()}>Kelola Barang</a>
        </div>
      </div>
    </div>
  );
}

function card(): React.CSSProperties {
  return { border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white" };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    textDecoration: "none",
    color: "#111",
    background: "white",
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "white",
    textDecoration: "none",
  };
}

function kpiLabel(): React.CSSProperties {
  return { fontSize: 12, color: "#666", fontWeight: 700, letterSpacing: 0.2 };
}
function kpiValue(): React.CSSProperties {
  return { marginTop: 8, fontSize: 22, fontWeight: 900 };
}
function kpiSub(): React.CSSProperties {
  return { marginTop: 6, fontSize: 13, color: "#555" };
}

function rowLink(): React.CSSProperties {
  return {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 12,
    textDecoration: "none",
    color: "#111",
    background: "#fff",
  };
}

function pill(state: "UNPAID" | "PARTIAL" | "PAID"): React.CSSProperties {
  if (state === "PAID") return { fontSize: 11, padding: "3px 8px", borderRadius: 999, border: "1px solid #6ee7b7", background: "#ecfdf5", color: "#065f46" };
  if (state === "PARTIAL") return { fontSize: 11, padding: "3px 8px", borderRadius: 999, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1e3a8a" };
  return { fontSize: 11, padding: "3px 8px", borderRadius: 999, border: "1px solid #fdba74", background: "#fff7ed", color: "#9a3412" };
}