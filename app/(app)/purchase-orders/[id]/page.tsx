"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import PoActionsClient from "./po-actions-client";

type PO = {
  id: string;
  po_number: string | null;
  po_date: string | null;
  vendor_name: string | null;
  vendor_phone: string | null;
  vendor_address: string | null;
  note: string | null;
  status: string | null;
  subtotal: number | null;
  total: number | null;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
};

type Item = {
  id: string;
  name: string | null;
  unit: string | null;
  qty: number | null;
  price: number | null;
  sort_order: number | null;
};

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function fmtMoney(n: any) {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
function fmtDate(iso: any) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
function badgeStyle(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "sent")
    return { border: "1px solid #bae6fd", background: "#f0f9ff", color: "#075985" };
  if (s === "received")
    return { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" };
  if (s === "partially_received")
    return { border: "1px solid #93c5fd", background: "#eff6ff", color: "#1e3a8a" };
  if (s === "cancelled")
    return { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" };
  return { border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151" };
}

export default function PODetailPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [po, setPo] = useState<PO | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        setErr("Unauthorized");
        setPo(null);
        setItems([]);
        return;
      }

      let poRow: any = null;

      const try1 = await supabase
        .from("purchase_orders")
        .select(
          "id,po_number,po_date,vendor_name,vendor_phone,vendor_address,note,status,subtotal,total,cancel_reason,cancelled_at"
        )
        .eq("id", id)
        .maybeSingle();

      if (!try1.error) {
        poRow = try1.data;
      } else {
        const try2 = await supabase
          .from("purchase_orders")
          .select(
            "id,po_number,po_date,vendor_name,vendor_phone,vendor_address,note,status,subtotal,total"
          )
          .eq("id", id)
          .maybeSingle();

        if (try2.error) throw try2.error;
        poRow = try2.data;
      }

      if (!poRow) {
        setErr("PO tidak ditemukan.");
        setPo(null);
        setItems([]);
        return;
      }

      const { data: itRows, error: itErr } = await supabase
        .from("purchase_order_items")
        .select("id,name,unit,qty,price,sort_order")
        .eq("purchase_order_id", id)
        .order("sort_order", { ascending: true });

      if (itErr) throw itErr;

      setPo(poRow as any);
      setItems((itRows as any) || []);
    } catch (e: any) {
      setErr(e?.message || "Gagal load PO.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  const sum = useMemo(
    () => items.reduce((a, it) => a + toNum(it.qty) * toNum(it.price), 0),
    [items]
  );

  const statusText = String(po?.status || "draft");
  const isCancelled = statusText.toLowerCase() === "cancelled";

  const pdfPreviewHref = po?.id ? `/api/purchase-orders/pdf/${po.id}` : "#";
  const pdfDownloadHref = po?.id
    ? `/api/purchase-orders/pdf/${po.id}?download=1`
    : "#";

  return (
    <div style={{ padding: 6 }}>
      <div style={topbar()}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Detail PO</div>
          <div style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}>
            {po?.po_number || "-"} • {po?.po_date ? fmtDate(po.po_date) : "-"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => router.push("/purchase-orders")}
            style={btnSoft()}
            disabled={loading}
          >
            Kembali
          </button>

          <Link href="/purchase-orders" style={btnSoftLink()}>
            List
          </Link>

          <a
            href={pdfPreviewHref}
            target="_blank"
            rel="noreferrer"
            style={btnSoftLink()}
            aria-disabled={!po?.id}
            onClick={(e) => {
              if (!po?.id) e.preventDefault();
            }}
          >
            Preview PDF
          </a>

          <a
            href={pdfDownloadHref}
            style={btnPrimaryLink()}
            aria-disabled={!po?.id}
            onClick={(e) => {
              if (!po?.id) e.preventDefault();
            }}
          >
            Download PDF
          </a>

          {po?.id ? (
            <PoActionsClient id={po.id} poNumber={po.po_number} status={po.status} />
          ) : null}
        </div>
      </div>

      {err ? <div style={errBox()}>{err}</div> : null}

      <div style={grid()}>
        <div style={card()}>
          <div style={sectionTitle()}>Vendor</div>
          {loading ? (
            <div>Loading...</div>
          ) : !po ? (
            <div>-</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={row()}>
                <div style={k()}>Nama</div>
                <div style={v()}>{po.vendor_name || "-"}</div>
              </div>
              <div style={row()}>
                <div style={k()}>Phone</div>
                <div style={v()}>{po.vendor_phone || "-"}</div>
              </div>
              <div style={row()}>
                <div style={k()}>Alamat</div>
                <div style={v()}>{po.vendor_address || "-"}</div>
              </div>

              {po.note ? (
                <div style={{ marginTop: 10 }}>
                  <div style={k()}>Catatan</div>
                  <div style={{ marginTop: 6, fontWeight: 850, color: "#111827" }}>
                    {po.note}
                  </div>
                </div>
              ) : null}

              <div style={{ marginTop: 10 }}>
                <div style={k()}>Status</div>
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ ...pill(), ...badgeStyle(statusText) }}>
                    {statusText}
                  </span>

                  {isCancelled && (po.cancel_reason || po.cancelled_at) ? (
                    <span style={pillSoft()}>
                      {po.cancel_reason ? `reason: ${po.cancel_reason}` : "cancelled"}
                      {po.cancelled_at ? ` • ${fmtDate(po.cancelled_at)}` : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={card()}>
          <div style={sectionTitle()}>Items</div>

          <div style={tableWrap()}>
            <table style={table()}>
              <thead>
                <tr>
                  <th style={th()}>Nama</th>
                  <th style={th()}>Unit</th>
                  <th style={thRight()}>Qty</th>
                  <th style={thRight()}>Harga</th>
                  <th style={thRight()}>Total</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td style={td()} colSpan={5}>
                      Loading...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td style={td()} colSpan={5}>
                      Tidak ada item.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => {
                    const line = toNum(it.qty) * toNum(it.price);
                    return (
                      <tr key={it.id}>
                        <td style={td()}>{it.name || "-"}</td>
                        <td style={td()}>{it.unit || "-"}</td>
                        <td style={tdRight()}>{toNum(it.qty)}</td>
                        <td style={tdRight()}>Rp {fmtMoney(it.price)}</td>
                        <td style={tdRight()}>Rp {fmtMoney(line)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginTop: 12,
              borderTop: "1px solid #e5e7eb",
              paddingTop: 12,
            }}
          >
            <div style={sumBox()}>
              <SumRow k="Subtotal" v={`Rp ${fmtMoney(po?.subtotal ?? sum)}`} />
              <SumRow k="Total" v={`Rp ${fmtMoney(po?.total ?? sum)}`} strong />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SumRow({
  k: kk,
  v: vv,
  strong,
}: {
  k: string;
  v: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontWeight: strong ? 1000 : 900,
        fontSize: strong ? 16 : 13,
      }}
    >
      <div style={{ color: strong ? "#111827" : "#6b7280" }}>{kk}</div>
      <div>{vv}</div>
    </div>
  );
}

function topbar(): React.CSSProperties {
  return {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  };
}
function grid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    alignItems: "start",
  };
}
function card(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
  };
}
function sectionTitle(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 950,
    color: "#6b7280",
    marginBottom: 10,
    letterSpacing: 0.2,
  };
}
function btnSoft(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
function btnSoftLink(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  };
}
function btnPrimaryLink(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  };
}
function errBox(): React.CSSProperties {
  return {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontWeight: 900,
  };
}
function row(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    gap: 10,
    alignItems: "start",
  };
}
function k(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 950, color: "#6b7280" };
}
function v(): React.CSSProperties {
  return { fontWeight: 900, color: "#111827" };
}
function pill(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    textTransform: "lowercase",
  };
}
function pillSoft(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    textTransform: "none",
  };
}
function tableWrap(): React.CSSProperties {
  return {
    width: "100%",
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
  };
}
function table(): React.CSSProperties {
  return {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    minWidth: 760,
  };
}
function th(): React.CSSProperties {
  return {
    textAlign: "left",
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 950,
    padding: "10px 12px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
  };
}
function thRight(): React.CSSProperties {
  return { ...th(), textAlign: "right" };
}
function td(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
    fontWeight: 800,
    color: "#111827",
    background: "white",
  };
}
function tdRight(): React.CSSProperties {
  return { ...td(), textAlign: "right" };
}
function sumBox(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 12,
    background: "#f9fafb",
    display: "grid",
    gap: 8,
  };
}