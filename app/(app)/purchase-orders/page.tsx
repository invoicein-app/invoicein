// ✅ FULL REPLACE FILE
// invoiceku/app/(app)/purchase-orders/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type PORow = {
  id: string;
  po_number: string | null;
  po_date: string | null;
  vendor_name: string | null;
  total: number | null;
  status: string | null;
};

function fmtMoney(n: any) {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDate(iso: any) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { year: "numeric", month: "2-digit", day: "2-digit" });
}
function statusLabel(status: any) {
  const s = String(status || "draft").toLowerCase();
  if (s === "draft") return "Draft";
  if (s === "sent") return "Sent";
  if (s === "cancelled") return "Cancelled";
  if (s === "received") return "Received";
  return s ? s[0].toUpperCase() + s.slice(1) : "Draft";
}
function badgeStyle(status: any) {
  const s = String(status || "draft").toLowerCase();
  if (s === "sent") return { border: "1px solid #0284c7", background: "#e0f2fe", color: "#0c4a6e" };
  if (s === "received") return { border: "1px solid #16a34a", background: "#dcfce7", color: "#14532d" };
  if (s === "cancelled") return { border: "1px solid #dc2626", background: "#fee2e2", color: "#7f1d1d" };
  return { border: "1px solid #9ca3af", background: "#f3f4f6", color: "#111827" };
}

export default function PurchaseOrdersListPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<PORow[]>([]);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        setRows([]);
        setErr("Unauthorized");
        return;
      }

      const { data: membership, error: memErr } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (memErr) throw memErr;

      const orgId = String((membership as any)?.org_id || "");
      if (!orgId) {
        setRows([]);
        setErr("Org tidak ditemukan. Pastikan membership aktif.");
        return;
      }

      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id,po_number,po_date,vendor_name,total,status")
        .eq("org_id", orgId)
        .order("po_date", { ascending: false })
        .limit(200);

      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      setErr(e?.message || "Gagal load purchase orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const blob = `${r.po_number || ""} ${r.vendor_name || ""} ${r.status || ""}`.toLowerCase();
      return blob.includes(s);
    });
  }, [rows, q]);

  return (
    <div style={{ padding: 6 }}>
      <div style={topbar()}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Purchase Orders</div>
          <div style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}>
            List PO yang sudah dibuat.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={load} style={btnSoft()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <Link href="/purchase-orders/new" style={btnPrimaryLink()}>
            + Buat PO
          </Link>
        </div>
      </div>

      {err ? <div style={errBox()}>{err}</div> : null}

      <div style={card()}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari PO number / vendor / status..."
            style={inpFull()}
          />
          <div style={{ fontWeight: 900, color: "#6b7280", whiteSpace: "nowrap" }}>
            {filtered.length} data
          </div>
        </div>

        <div style={tableWrap()}>
          <table style={table()}>
            <thead>
              <tr>
                <th style={th()}>No</th>
                <th style={th()}>Tanggal</th>
                <th style={th()}>Vendor</th>
                <th style={thRight()}>Total</th>
                <th style={th()}>Status</th>
                <th style={th()}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td style={td()} colSpan={6}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td style={td()} colSpan={6}>Tidak ada data.</td></tr>
              ) : (
                filtered.map((r) => {
                  const st = String(r.status || "draft");
                  return (
                    <tr key={r.id}>
                      <td style={tdMono()}>
                        <Link href={`/purchase-orders/${r.id}`} style={linkClick()}>
                          {r.po_number || "-"}
                        </Link>
                      </td>
                      <td style={td()}>{fmtDate(r.po_date)}</td>
                      <td style={td()}>
                        <div style={{ fontWeight: 900 }}>{r.vendor_name || "-"}</div>
                      </td>
                      <td style={tdRight()}>Rp {fmtMoney(r.total)}</td>
                      <td style={td()}>
                        <span style={{ ...badge(), ...badgeStyle(st) }}>{statusLabel(st)}</span>
                      </td>
                      <td style={td()}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => router.push(`/purchase-orders/${r.id}`)} style={btnSoftSmall()}>
                            Detail
                          </button>
                          <button type="button" onClick={() => router.push(`/purchase-orders/${r.id}`)} style={btnPrimarySmall()}>
                            Buka
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** styles */
function topbar(): React.CSSProperties {
  return { display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 };
}
function card(): React.CSSProperties {
  return { border: "1px solid #e5e7eb", background: "white", borderRadius: 14, padding: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" };
}
function errBox(): React.CSSProperties {
  return { marginBottom: 12, padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 900 };
}
function baseInput(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", outline: "none", fontWeight: 800, background: "white", lineHeight: "20px", height: 42, boxSizing: "border-box" };
}
function inpFull(): React.CSSProperties {
  return { ...baseInput(), width: "100%" };
}
function btnSoft(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none", display: "inline-block" };
}
function btnPrimaryLink(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none", display: "inline-block" };
}
function tableWrap(): React.CSSProperties {
  return { width: "100%", overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12 };
}
function table(): React.CSSProperties {
  return { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 820 };
}
function th(): React.CSSProperties {
  return { textAlign: "left", fontSize: 12, color: "#6b7280", fontWeight: 950, padding: "10px 12px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb", position: "sticky", top: 0, zIndex: 1 };
}
function thRight(): React.CSSProperties {
  return { ...th(), textAlign: "right" };
}
function td(): React.CSSProperties {
  return { padding: "10px 12px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", fontWeight: 800, color: "#111827", background: "white" };
}
function tdRight(): React.CSSProperties {
  return { ...td(), textAlign: "right" };
}
function tdMono(): React.CSSProperties {
  return { ...td(), fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" };
}
function badge(): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 1000, letterSpacing: 0.2 };
}
function btnSoftSmall(): React.CSSProperties {
  return { padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" };
}
function btnPrimarySmall(): React.CSSProperties {
  return { padding: "8px 10px", borderRadius: 10, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" };
}
function linkClick(): React.CSSProperties {
  return { color: "#111827", textDecoration: "underline", fontWeight: 1000, cursor: "pointer", pointerEvents: "auto" };
}
