// ✅ FULL REPLACE FILE
// invoiceku/app/(app)/purchase-orders/[id]/receive/page.tsx
//
// FIX:
// ✅ bisa GRN saat status: SENT atau PARTIALLY_RECEIVED
// ✅ warning text tidak lagi "harus SENT"
// ✅ tombol Post disabled kalau status tidak valid (RECEIVED/CANCELLED/etc)

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string;
  is_active: boolean;
};

type PO = {
  id: string;
  po_number: string | null;
  status: string | null;
  vendor_name: string | null;
  org_id: string | null;
  warehouse_id: string | null;
  ship_to_name: string | null;
  ship_to_phone: string | null;
  ship_to_address: string | null;
};

type POItem = {
  id: string;
  name: string;
  qty: number;
};

type LineDraft = {
  po_item_id: string;
  item_name: string;
  ordered: number;
  received: number;
  remaining: number;

  qty_now: number;
  qty_now_text: string;

  production_date: string; // yyyy-mm-dd or ""
  expired_date: string; // yyyy-mm-dd or ""
  expiry_preset: string; // "none" | "0m" | "1m" | ... | "1y" | "2y"
};

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function digitsOnlyString(raw: string) {
  return String(raw ?? "").replace(/\D/g, "");
}

function fmtDateInput(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addMonths(base: Date, months: number) {
  const d = new Date(base);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function addYears(base: Date, years: number) {
  const d = new Date(base);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function parseDateOrNull(s: string) {
  const t = String(s || "").trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function canReceiveStatus(status: string) {
  const st = String(status || "").toLowerCase();
  return st === "sent" || st === "partially_received";
}

export default function POReceivePage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState("");

  const [po, setPo] = useState<PO | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // header receive form
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [sjNo, setSjNo] = useState<string>("");
  const [receivedDate, setReceivedDate] = useState<string>(() => fmtDateInput(new Date()));
  const [notes, setNotes] = useState<string>("");

  const [lines, setLines] = useState<LineDraft[]>([]);

  const selectedWarehouse = useMemo(() => {
    return warehouses.find((w) => w.id === warehouseId) || null;
  }, [warehouses, warehouseId]);

  const totalQtyNow = useMemo(() => {
    return lines.reduce((a, x) => a + Math.max(0, Math.floor(num(x.qty_now))), 0);
  }, [lines]);

  const statusText = String(po?.status || "-").toUpperCase();
  const canPost = canReceiveStatus(String(po?.status || ""));

  const validationError = useMemo(() => {
    if (!canPost) {
      return "PO ini tidak bisa menerima barang lagi. Status harus SENT atau PARTIALLY_RECEIVED.";
    }

    if (lines.every((x) => Math.max(0, Math.floor(num(x.qty_now))) === 0)) {
      return "Isi minimal 1 item Qty Receive Now > 0.";
    }

    const bad = lines.find((x) => Math.floor(num(x.qty_now)) > Math.floor(num(x.remaining)));
    if (bad) return "Qty diterima melebihi sisa (Remaining) untuk item.";

    return "";
  }, [lines, canPost]);

  function setLine(poItemId: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((x) => (x.po_item_id === poItemId ? { ...x, ...patch } : x)));
  }

  function applyExpiryPreset(poItemId: string, preset: string) {
    // update preset dulu
    setLine(poItemId, { expiry_preset: preset });

    if (preset === "none") {
      setLine(poItemId, { expired_date: "" });
      return;
    }

    const ln = lines.find((x) => x.po_item_id === poItemId);
    const base =
      parseDateOrNull(ln?.production_date || "") ||
      parseDateOrNull(receivedDate) ||
      new Date();

    let next: Date | null = null;

    if (preset.endsWith("m")) {
      const m = Number(preset.replace("m", ""));
      next = addMonths(base, m);
    } else if (preset.endsWith("y")) {
      const y = Number(preset.replace("y", ""));
      next = addYears(base, y);
    }

    if (!next) return;
    setLine(poItemId, { expired_date: fmtDateInput(next) });
  }

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        setMsg("Unauthorized");
        setPo(null);
        return;
      }

      // PO
      const { data: poRow, error: poErr } = await supabase
        .from("purchase_orders")
        .select("id,po_number,status,vendor_name,org_id,warehouse_id,ship_to_name,ship_to_phone,ship_to_address")
        .eq("id", id)
        .maybeSingle();

      if (poErr) throw poErr;
      if (!poRow) {
        setMsg("PO tidak ditemukan.");
        setPo(null);
        return;
      }

      // items PO
      const { data: items, error: itErr } = await supabase
        .from("purchase_order_items")
        .select("id,name,qty,sort_order")
        .eq("purchase_order_id", id)
        .order("sort_order", { ascending: true });

      if (itErr) throw itErr;

      // received aggregate (sum dari po_receipt_lines)
      const { data: recAgg, error: aggErr } = await supabase
        .from("po_receipt_lines")
        .select("po_item_id, qty_received")
        .in(
          "po_item_id",
          (items || []).map((x: any) => x.id)
        );

      if (aggErr) throw aggErr;

      const sumMap = new Map<string, number>();
      (recAgg as any[] | null)?.forEach((r) => {
        const key = String(r.po_item_id || "");
        const val = Math.max(0, Math.floor(num(r.qty_received)));
        sumMap.set(key, (sumMap.get(key) || 0) + val);
      });

      // warehouses for org
      const orgId = String((poRow as any).org_id || "");
      const { data: whs, error: whErr } = await supabase
        .from("warehouses")
        .select("id,code,name,phone,address,is_active")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(500);

      if (whErr) throw whErr;

      setPo(poRow as any);
      setWarehouses((whs as any) || []);

      const defaultWh =
        String((poRow as any).warehouse_id || "") ||
        String((whs as any)?.[0]?.id || "");
      setWarehouseId(defaultWh);

      const built: LineDraft[] =
        ((items as any[]) || []).map((it) => {
          const ordered = Math.max(0, Math.floor(num(it.qty)));
          const received = Math.max(0, Math.floor(num(sumMap.get(String(it.id)) || 0)));
          const remaining = Math.max(0, ordered - received);
          return {
            po_item_id: String(it.id),
            item_name: String(it.name || ""),
            ordered,
            received,
            remaining,
            qty_now: 0,
            qty_now_text: "",
            production_date: "",
            expired_date: "",
            expiry_preset: "none",
          };
        }) || [];

      setLines(built);
    } catch (e: any) {
      setMsg(e?.message || "Gagal load GRN.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function onChangeQty(poItemId: string, raw: string) {
    const digits = digitsOnlyString(raw);
    const q = digits === "" ? 0 : Math.max(0, Math.floor(Number(digits)));
    setLine(poItemId, { qty_now_text: digits, qty_now: q });
  }

  function onBlurQty(poItemId: string) {
    const ln = lines.find((x) => x.po_item_id === poItemId);
    if (!ln) return;
    const q = Math.max(0, Math.floor(num(ln.qty_now)));
    const nextText = ln.qty_now_text === "" ? "" : String(q);
    setLine(poItemId, { qty_now: q, qty_now_text: nextText });
  }

  async function postReceive() {
    setMsg("");

    if (!po) return setMsg("PO tidak ditemukan.");

    if (!canPost) {
      return setMsg("PO status harus SENT atau PARTIALLY_RECEIVED untuk menerima barang.");
    }

    if (!warehouseId) return setMsg("Pilih gudang (Ship To) dulu.");
    if (validationError) return setMsg(validationError);

    const payload = {
      warehouse_id: warehouseId,
      sj_no: String(sjNo || "").trim() || null,
      received_date: String(receivedDate || "").trim() || null,
      notes: String(notes || "").trim() || null,
      lines: lines
        .map((x) => ({
          po_item_id: x.po_item_id,
          item_name: x.item_name,
          qty_received: Math.max(0, Math.floor(num(x.qty_now))),
          production_date: x.production_date || null,
          expired_date: x.expired_date || null,
        }))
        .filter((x) => x.qty_received > 0),
    };

    setPosting(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) return setMsg(json?.error || `Gagal post receive (${res.status})`);

      router.push(`/purchase-orders/${id}`);
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || "Gagal post receive.");
    } finally {
      setPosting(false);
    }
  }

  const poNo = po?.po_number || "-";
  const vendor = po?.vendor_name || "-";

  return (
    <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Terima Barang (GRN)</h1>
          <div style={{ marginTop: 6, color: "#666", fontWeight: 700 }}>
            PO: {poNo} • Vendor: {vendor}
          </div>
          <div style={{ marginTop: 8, fontWeight: 900, color: canPost ? "#0f766e" : "#b45309" }}>
            Status: {statusText} {canPost ? "" : "(tidak bisa GRN)"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/purchase-orders/${id}`} style={btn()}>
            Kembali
          </Link>
          <button onClick={postReceive} disabled={!canPost || posting || loading} style={btnPrimary()}>
            {posting ? "Posting..." : "Post Receive"}
          </button>
        </div>
      </div>

      {msg ? <div style={errBox()}>{msg}</div> : null}

      {!canPost ? (
        <div style={{ marginTop: 12, ...warnBox() }}>
          PO hanya bisa menerima barang saat status <b>SENT</b> atau <b>PARTIALLY_RECEIVED</b>.
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={card()}>
          <h3 style={{ margin: 0 }}>Info Receive</h3>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={label()}>
              Gudang (Ship To)
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} style={input()}>
                <option value="">- pilih gudang -</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} • {w.name}
                  </option>
                ))}
              </select>

              {selectedWarehouse ? (
                <div style={shipToCard()}>
                  <div style={{ fontWeight: 900 }}>{selectedWarehouse.name}</div>
                  {selectedWarehouse.phone ? <div style={{ color: "#444" }}>{selectedWarehouse.phone}</div> : null}
                  <div style={{ color: "#444" }}>{selectedWarehouse.address}</div>
                </div>
              ) : null}
            </label>

            <label style={label()}>
              SJ No (optional)
              <input value={sjNo} onChange={(e) => setSjNo(e.target.value)} style={input()} placeholder="Nomor surat jalan vendor" />
            </label>

            <label style={label()}>
              Tanggal Terima
              <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Notes (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ ...input(), minHeight: 90, resize: "vertical" }}
                placeholder="karton basah, rusak 3, dll"
              />
            </label>
          </div>
        </div>

        <div style={card()}>
          <h3 style={{ margin: 0 }}>Ringkasan</h3>
          <div style={{ marginTop: 10 }}>
            <Row k="Total qty diterima (sekarang)" v={<b>{totalQtyNow}</b>} />
            <div style={{ marginTop: 10, color: "#666", fontSize: 13 }}>
              Setelah Post, GRN tersimpan, stok gudang bertambah (via trigger/ledger), PO auto update jadi PARTIALLY_RECEIVED / RECEIVED.
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, ...card() }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Items Receive</h3>
          <button onClick={load} style={btn()} disabled={loading || posting}>
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th()}>Item</th>
                <th style={th()}>Ordered</th>
                <th style={th()}>Received</th>
                <th style={th()}>Remaining</th>
                <th style={th()}>Receive Now</th>
                <th style={th()}>Prod Date</th>
                <th style={th()}>Exp Date</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((ln) => {
                const over = Math.floor(num(ln.qty_now)) > Math.floor(num(ln.remaining));
                return (
                  <tr key={ln.po_item_id}>
                    <td style={td()}>
                      <div style={{ fontWeight: 900 }}>{ln.item_name}</div>
                    </td>
                    <td style={td()}>{ln.ordered}</td>
                    <td style={td()}>{ln.received}</td>
                    <td style={td()}>{ln.remaining}</td>

                    <td style={td()}>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={ln.qty_now_text}
                        onChange={(e) => onChangeQty(ln.po_item_id, e.target.value)}
                        onBlur={() => onBlurQty(ln.po_item_id)}
                        style={{
                          ...input(),
                          borderColor: over ? "#ef4444" : "#ddd",
                          background: over ? "#fff1f2" : "white",
                          maxWidth: 120,
                        }}
                        placeholder="0"
                        disabled={!canPost}
                      />
                      <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                        max: {ln.remaining}
                      </div>
                    </td>

                    <td style={td()}>
                      <input
                        type="date"
                        value={ln.production_date}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLine(ln.po_item_id, { production_date: v });
                          if (ln.expiry_preset && ln.expiry_preset !== "none") {
                            setTimeout(() => applyExpiryPreset(ln.po_item_id, ln.expiry_preset), 0);
                          }
                        }}
                        style={{ ...input(), maxWidth: 150 }}
                        disabled={!canPost}
                      />
                    </td>

                    <td style={td()}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <select
                          value={ln.expiry_preset}
                          onChange={(e) => applyExpiryPreset(ln.po_item_id, e.target.value)}
                          style={{ ...input(), maxWidth: 170 }}
                          title="Shortcut expired date"
                          disabled={!canPost}
                        >
                          <option value="none">No expiry</option>
                          <option value="0m">0 bulan</option>
                          <option value="1m">1 bulan</option>
                          <option value="3m">3 bulan</option>
                          <option value="6m">6 bulan</option>
                          <option value="12m">12 bulan</option>
                          <option value="24m">24 bulan</option>
                          <option value="1y">1 tahun</option>
                          <option value="2y">2 tahun</option>
                          <option value="3y">3 tahun</option>
                        </select>

                        <input
                          type="date"
                          value={ln.expired_date}
                          onChange={(e) =>
                            setLine(ln.po_item_id, {
                              expired_date: e.target.value,
                              expiry_preset: ln.expiry_preset,
                            })
                          }
                          style={{ ...input(), maxWidth: 170 }}
                          placeholder="(optional)"
                          disabled={!canPost}
                        />
                        <div style={{ fontSize: 12, color: "#666" }}>
                          Optional (jasa/benda mati boleh kosong).
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p style={{ marginTop: 10, color: "#666" }}>
            Tips: isi qty hanya untuk item yang datang. PO bisa menerima barang berkali-kali (partial).
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
      <span style={{ color: "#666" }}>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function card(): React.CSSProperties {
  return { border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white", boxSizing: "border-box" };
}
function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 13, color: "#444", fontWeight: 800 };
}
function input(): React.CSSProperties {
  return { padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%", boxSizing: "border-box", outline: "none", background: "white" };
}
function btn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer", textDecoration: "none", color: "#111", fontWeight: 900 };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", cursor: "pointer", fontWeight: 900 };
}
function errBox(): React.CSSProperties {
  return { marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 900 };
}
function warnBox(): React.CSSProperties {
  return { padding: 12, borderRadius: 12, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", fontWeight: 900 };
}
function th(): React.CSSProperties {
  return { textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px", color: "#666", fontWeight: 700, whiteSpace: "nowrap" };
}
function td(): React.CSSProperties {
  return { borderBottom: "1px solid #f2f2f2", padding: "10px 6px", verticalAlign: "top" };
}
function shipToCard(): React.CSSProperties {
  return { marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#fafafa", lineHeight: 1.35 };
}