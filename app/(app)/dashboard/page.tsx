// invoiceku/app/dashboard/page.tsx  (FULL REPLACE)
//
// Dashboard v1 (berguna + gak kopong) — FIX duplicate month key
// - KPI cards: Outstanding (UNPAID/PARTIAL), Paid bulan ini, Paid bulan lalu, Total invoice
// - "Butuh perhatian": 8 invoice unpaid/partial paling lama (clickable)
// - Mini chart: Omset Paid 6 bulan terakhir (bar chart pakai div, tanpa library)
// - Quick stats: jumlah customer + products
//
// FIX PENTING:
// ✅ monthKeys6 unik (anchor ke tanggal 1) biar gak double (issue JS Date 29/30/31)
// ✅ semua query di-filter by org_id
// ✅ status bayar dihitung dari grandTotal vs amount_paid
// ✅ discount_value & tax_value dianggap persen (0-100)

import { supabaseServer } from "@/lib/supabase/server";
import { rupiah } from "@/lib/money";

function clampPercent(v: any) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function monthKeyFromDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// selalu balik ke tanggal 1 agar setMonth() gak "lompat" (29/30/31 issue)
function monthStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(1);
  return x;
}

function addMonthsSafe(base: Date, delta: number) {
  const d = monthStart(base);
  d.setMonth(d.getMonth() + delta);
  return d;
}

function formatMonthKeyId(key: string) {
  const [y, m] = key.split("-");
  const mi = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${months[mi]} ${y}`;
}

function BellIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="#2D7D71"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#2D7D71" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="#2D7D71" strokeWidth="2" />
      <path
        d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1"
        stroke="#2D7D71"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default async function DashboardPage() {
  const supabase = await supabaseServer();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;

  if (!user) {
    return (
      <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
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
      <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
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

  // Ambil invoices + items (1 query) — filter org_id
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

  // Quick counts
  const [{ count: customerCount }, { count: productCount }] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);

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

  // KPI
  let outstandingCount = 0;
  let outstandingSum = 0;

  let paidCount = 0;
  let paidSumThisMonth = 0;
  let paidSumLastMonth = 0;

  const now = new Date();
  const base = monthStart(now);

  const thisMonthKey = monthKeyFromDate(base);
  const lastMonthKey = monthKeyFromDate(addMonthsSafe(base, -1));

  // ✅ byMonth (paid) 6 bulan terakhir — FIX duplicate keys
  const monthKeys6 = Array.from({ length: 6 }, (_, i) => {
    const d = addMonthsSafe(base, -(5 - i));
    return monthKeyFromDate(d);
  });

  const paidByMonth = new Map<string, number>();
  monthKeys6.forEach((k) => paidByMonth.set(k, 0));

  // attention candidates
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
    const mk = dt ? monthKeyFromDate(monthStart(dt)) : ""; // anchor biar konsisten

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

  attention.sort((a, b) => {
    const da = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
    const db = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
    return da - db;
  });

  const attentionTop = attention.slice(0, 8);

  const monthStartStr = `${thisMonthKey}-01`;
  const monthEndDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const monthEndStr = `${thisMonthKey}-${String(monthEndDay).padStart(2, "0")}`;

  const { data: expenseRows } = await supabase
    .from("expenses")
    .select("amount, payment_status")
    .eq("org_id", orgId)
    .gte("expense_date", monthStartStr)
    .lte("expense_date", monthEndStr);

  let expensePaidThisMonth = 0;
  let expenseUnpaidThisMonth = 0;
  for (const e of expenseRows || []) {
    const amt = Number((e as any).amount) || 0;
    if ((e as any).payment_status === "paid") expensePaidThisMonth += amt;
    else expenseUnpaidThisMonth += amt;
  }
  const profitEstimateThisMonth = paidSumThisMonth - expensePaidThisMonth;

  const monthBars = monthKeys6.map((k) => ({ month: k, value: paidByMonth.get(k) || 0 }));
  const maxBar = Math.max(1, ...monthBars.map((x) => x.value));

  const chartRangeLabel = `${formatMonthKeyId(monthKeys6[0])} – ${formatMonthKeyId(monthKeys6[5])}`;

  return (
    <div style={pageWrap()}>
      {/* Main header: title + bell / profile */}
      <div style={dashHeaderRow()}>
        <div>
          <h1 style={dashTitle()}>Dashboard</h1>
          <p style={dashSubtitle()}>
            {orgName ? `${orgName}` : "Organisasi"} • {role}
          </p>
          {invErr?.message ? (
            <p style={{ marginTop: 8, color: "#b00", fontSize: 13 }}>Error baca invoices: {invErr.message}</p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/settings/activity" style={iconBtn()} title="Notifikasi / aktivitas" aria-label="Notifikasi">
            <BellIcon />
          </a>
          <a href="/settings" style={iconBtn()} title="Profil & pengaturan" aria-label="Pengaturan">
            <UserIcon />
          </a>
        </div>
      </div>

      {/* Rekap Data Invoice */}
      <h2 style={sectionHeading()}>Rekap Data Invoice</h2>
      <div style={kpiGrid()}>
        <div style={kpiCardCream()}>
          <div style={kpiLabel()}>Outstanding</div>
          <div style={kpiValue()}>{outstandingCount}</div>
          <div style={kpiInset()}>
            Sisa tagihan : <b>{rupiah(outstandingSum)}</b>
          </div>
        </div>

        <div style={kpiCardGray()}>
          <div style={kpiLabel()}>Paid Bulan Ini</div>
          <div style={kpiValue()}>{rupiah(paidSumThisMonth)}</div>
          <div style={kpiInset()}>
            {formatMonthKeyId(thisMonthKey)}
          </div>
        </div>

        <div style={kpiCardGray()}>
          <div style={kpiLabel()}>Paid Bulan Lalu</div>
          <div style={kpiValue()}>{rupiah(paidSumLastMonth)}</div>
          <div style={kpiInset()}>
            {formatMonthKeyId(lastMonthKey)}
          </div>
        </div>

        <div style={kpiCardBlue()}>
          <div style={kpiLabel()}>Total Invoice</div>
          <div style={kpiValue()}>{invoices.length}</div>
          <div style={{ ...kpiInset(), display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
            <span style={kpiInsetStat()}>Paid: {paidCount}</span>
            <span style={kpiInsetStat()}>Cust: {customerCount ?? 0}</span>
            <span style={kpiInsetStat()}>Product: {productCount ?? 0}</span>
          </div>
        </div>

        <div style={kpiCardGray()}>
          <div style={kpiLabel()}>Pengeluaran Lunas</div>
          <div style={kpiValue()}>{rupiah(expensePaidThisMonth)}</div>
          <div style={kpiInset()}>
            Belum lunas: <b>{rupiah(expenseUnpaidThisMonth)}</b>
          </div>
        </div>

        <div style={kpiCardCream()}>
          <div style={kpiLabel()}>Perkiraan Laba Bulan Ini</div>
          <div style={kpiValue()}>{rupiah(profitEstimateThisMonth)}</div>
          <div style={kpiInset()}>
            Omset lunas − pengeluaran lunas
          </div>
        </div>
      </div>

      {/* Menu Utama */}
      <div style={menuUtamaBox()}>
        <div style={menuUtamaTitle()}>Menu Utama</div>
        <div style={menuUtamaRow()}>
          <a href="/invoice/new" style={menuBtnPrimary()}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Buat Invoice
          </a>
          <a href="/invoice" style={menuBtnOutline()}>
            Daftar Invoice
          </a>
          <a href="/delivery-notes" style={menuBtnOutline()}>
            Surat Jalan
          </a>
          <a href="/products" style={menuBtnOutline()}>
            Barang
          </a>
          <a href="/expenses" style={menuBtnOutline()}>
            Pengeluaran
          </a>
          <a href="/expenses/summary" style={menuBtnOutline()}>
            Ringkasan Laba
          </a>
        </div>
      </div>

      {/* Bottom: table + chart */}
      <div style={bottomGrid()}>
        {/* Butuh Perhatian */}
        <div style={cardElevated()}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>Butuh Perhatian</h3>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
            UNPAID / PARTIAL tertua — klik baris untuk buka detail
          </p>

          {attentionTop.length === 0 ? (
            <p style={{ color: "#64748b", margin: "16px 0 0", fontSize: 14 }}>
              Aman. Tidak ada invoice outstanding.
            </p>
          ) : (
            <>
              <div style={tableHeaderRow()}>
                <div>Nomor Invoice</div>
                <div style={{ textAlign: "right" }}>Nominal</div>
                <div style={{ textAlign: "center" }}>Status</div>
              </div>
              <div style={{ marginTop: 0 }}>
                {attentionTop.map((x) => (
                  <a key={x.id} href={`/invoice/${x.id}`} style={tableRow()}>
                    <div>
                      <div style={{ fontWeight: 800, color: "#111", fontSize: 14 }}>
                        {x.invoice_number || `Invoice ${x.id.slice(0, 8)}…`}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                        {x.invoice_date || "-"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>{rupiah(x.remaining)}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>dari {rupiah(x.grandTotal)}</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <span style={pill(x.payState)}>{x.payState}</span>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}

          <div style={{ marginTop: 14 }}>
            <a href="/invoice" style={linkMuted()}>
              Lihat semua invoice →
            </a>
          </div>
        </div>

        {/* Omset Dibayar */}
        <div style={cardElevated()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>Omset Dibayar</h3>
            <div style={dateRangePill()}>{chartRangeLabel}</div>
          </div>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {monthBars.map((m) => {
              const pct = Math.max(4, Math.round((m.value / maxBar) * 100));
              return (
                <div
                  key={m.month}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "88px 1fr 100px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{formatMonthKeyId(m.month)}</div>
                  <div
                    style={{
                      height: 22,
                      background: "#E8E8E8",
                      borderRadius: 6,
                      overflow: "hidden",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ width: `${pct}%`, height: "100%", background: "#2D7D71", borderRadius: 5 }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", textAlign: "right" }}>
                    {rupiah(m.value)}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, background: "#2D7D71", borderRadius: 2, display: "inline-block" }} />
            <span style={{ fontSize: 13, color: "#64748b" }}>Omset Paid</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function pageWrap(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: "100%",
    padding: "20px 24px 32px",
    boxSizing: "border-box",
    background: "#F5F7F9",
    minHeight: "100%",
  };
}

function dashHeaderRow(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 8,
  };
}

function dashTitle(): React.CSSProperties {
  return { margin: 0, fontSize: 22, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.02em" };
}

function dashSubtitle(): React.CSSProperties {
  return { marginTop: 6, fontSize: 13, color: "#64748b" };
}

function iconBtn(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    borderRadius: 8,
    background: "rgba(45, 125, 113, 0.12)",
    border: "1px solid rgba(45, 125, 113, 0.2)",
    textDecoration: "none",
    boxSizing: "border-box",
  };
}

function sectionHeading(): React.CSSProperties {
  return {
    margin: "20px 0 12px",
    fontSize: 15,
    fontWeight: 800,
    color: "#334155",
  };
}

function kpiGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  };
}

function kpiCardCream(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 16,
    background: "#FFF9E7",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    border: "1px solid rgba(0,0,0,0.04)",
    boxSizing: "border-box",
  };
}

function kpiCardGray(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 16,
    background: "#F0F0F0",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    border: "1px solid rgba(0,0,0,0.04)",
    boxSizing: "border-box",
  };
}

function kpiCardBlue(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 16,
    background: "#E7F3FF",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    border: "1px solid rgba(0,0,0,0.04)",
    boxSizing: "border-box",
  };
}

function kpiInset(): React.CSSProperties {
  return {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 8,
    background: "#fff",
    fontSize: 13,
    color: "#475569",
    border: "1px solid rgba(0,0,0,0.06)",
  };
}

function kpiInsetStat(): React.CSSProperties {
  return { fontWeight: 600, color: "#334155" };
}

function kpiLabel(): React.CSSProperties {
  return { fontSize: 12, color: "#64748b", fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" as const };
}

function kpiValue(): React.CSSProperties {
  return { marginTop: 8, fontSize: 26, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" };
}

function menuUtamaBox(): React.CSSProperties {
  return {
    marginTop: 20,
    padding: 18,
    borderRadius: 12,
    background: "#fff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    boxSizing: "border-box",
  };
}

function menuUtamaTitle(): React.CSSProperties {
  return { fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 14 };
}

function menuUtamaRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  };
}

function menuBtnPrimary(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 14px",
    borderRadius: 8,
    background: "#2D7D71",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    textDecoration: "none",
    border: "1px solid #2D7D71",
    boxSizing: "border-box",
  };
}

function menuBtnOutline(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 14px",
    borderRadius: 8,
    background: "#fff",
    color: "#2D7D71",
    fontWeight: 700,
    fontSize: 14,
    textDecoration: "none",
    border: "2px solid #2D7D71",
    boxSizing: "border-box",
  };
}

function bottomGrid(): React.CSSProperties {
  return {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
    gap: 16,
    alignItems: "start",
  };
}

function cardElevated(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 18,
    background: "#fff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    boxSizing: "border-box",
  };
}

function tableHeaderRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 100px",
    gap: 12,
    padding: "10px 12px",
    marginTop: 14,
    background: "#F0F0F0",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  };
}

function tableRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 100px",
    gap: 12,
    alignItems: "center",
    padding: "12px 12px",
    marginTop: 8,
    background: "#fafafa",
    borderRadius: 8,
    border: "1px solid #eee",
    textDecoration: "none",
    color: "inherit",
    boxSizing: "border-box",
  };
}

function linkMuted(): React.CSSProperties {
  return { fontSize: 13, fontWeight: 600, color: "#2D7D71", textDecoration: "none" };
}

function dateRangePill(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 8,
    background: "#fff",
    border: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
  };
}

function pill(state: "UNPAID" | "PARTIAL" | "PAID"): React.CSSProperties {
  if (state === "PAID")
    return {
      fontSize: 11,
      fontWeight: 800,
      padding: "4px 10px",
      borderRadius: 999,
      background: "#E8F5E9",
      color: "#2E7D32",
    };
  if (state === "PARTIAL")
    return {
      fontSize: 11,
      fontWeight: 800,
      padding: "4px 10px",
      borderRadius: 999,
      background: "#FFF4E5",
      color: "#ED6C02",
    };
  return {
    fontSize: 11,
    fontWeight: 800,
    padding: "4px 10px",
    borderRadius: 999,
    background: "#FFE5E5",
    color: "#D32F2F",
  };
}
