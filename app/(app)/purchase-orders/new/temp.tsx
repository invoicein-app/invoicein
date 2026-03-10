// ✅ FULL REPLACE FILE
// invoiceku/app/(app)/purchase-orders/new/page.tsx
"use client";

import { useMemo, useState } from "react";
import { num, rupiah } from "@/lib/money";

type Item = {
  name: string;
  qty: number;
  price: number;
  qtyText: string;
  priceText: string;
};

function digitsOnlyString(raw: string) {
  return String(raw ?? "").replace(/\D/g, "");
}
function digitsToNumber(raw: string) {
  const s = digitsOnlyString(raw).replace(/^0+/, "");
  return s === "" ? 0 : Number(s);
}
function formatThousandsID(n: number) {
  const x = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  return x === 0 ? "" : x.toLocaleString("id-ID");
}

export default function PONewPage() {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [poDate, setPoDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [vendorName, setVendorName] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [note, setNote] = useState("");

  const [items, setItems] = useState<Item[]>([
    { name: "", qty: 1, qtyText: "1", price: 0, priceText: "" },
  ]);

  const calc = useMemo(() => {
    const sub = items.reduce((a, it) => a + num(it.qty) * num(it.price), 0);
    return { sub, total: sub };
  }, [items]);

  function setItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function addItem() {
    setItems((prev) => [...prev, { name: "", qty: 1, qtyText: "1", price: 0, priceText: "" }]);
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onChangeQty(rowIdx: number, raw: string) {
    const digits = digitsOnlyString(raw);
    const qtyNum = digits === "" ? 0 : Math.max(0, Math.floor(Number(digits)));
    setItem(rowIdx, { qtyText: digits, qty: qtyNum });
  }
  function onBlurQty(rowIdx: number) {
    const it = items[rowIdx];
    const q = Math.max(0, Math.floor(num(it.qty)));
    const nextText = it.qtyText === "" ? "" : String(q);
    setItem(rowIdx, { qty: q, qtyText: nextText });
  }

  function onChangePrice(rowIdx: number, raw: string) {
    const n = digitsToNumber(raw);
    setItem(rowIdx, { price: n, priceText: formatThousandsID(n) });
  }
  function onBlurPrice(rowIdx: number) {
    const it = items[rowIdx];
    const n = Math.max(0, Math.floor(num(it.price)));
    setItem(rowIdx, { price: n, priceText: formatThousandsID(n) });
  }

  async function save() {
    setMsg("");
    if (!vendorName.trim()) return setMsg("Vendor name wajib diisi.");
    if (items.length === 0) return setMsg("Minimal 1 item.");
    if (items.some((it) => !it.name.trim())) return setMsg("Nama item tidak boleh kosong.");

    setSaving(true);
    try {
      const payload: any = {
        po_date: poDate,
        vendor_name: vendorName,
        vendor_phone: vendorPhone || "",
        vendor_address: vendorAddress || "",
        note: note || "",
        items: items.map((it) => ({
          name: String(it.name || ""),
          qty: Math.max(0, Math.floor(num(it.qty))),
          price: Math.max(0, Math.floor(num(it.price))),
        })),
      };

      const res = await fetch("/api/purchase-orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setMsg(json?.error || `Gagal simpan (${res.status})`);
        return;
      }

      window.location.href = `/purchase-orders/${json.id}`;
    } catch (e: any) {
      setMsg(e?.message || "Gagal simpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>PO Baru</h1>
          <p style={{ marginTop: 6, color: "#666" }}>Purchase Order untuk pembelian ke vendor</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/purchase-orders" style={btn()}>Kembali</a>
          <button onClick={save} disabled={saving} style={btnPrimary()}>
            {saving ? "Menyimpan..." : "Simpan PO"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={card()}>
          <h3 style={{ margin: 0 }}>Info PO</h3>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={label()}>
              Tanggal
              <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Vendor Name (wajib)
              <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Vendor Phone
              <input value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Vendor Address
              <textarea value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} style={{ ...input(), minHeight: 80 }} />
            </label>

            <label style={label()}>
              Catatan
              <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input(), minHeight: 80 }} />
            </label>

            {msg ? <p style={{ color: "#b00", margin: 0 }}>{msg}</p> : null}
          </div>
        </div>

        <div style={card()}>
          <h3 style={{ margin: 0 }}>Ringkasan</h3>
          <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 10 }}>
            <Row k="Subtotal" v={rupiah(calc.sub)} />
            <Row k="Total" v={<b>{rupiah(calc.total)}</b>} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, ...card() }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Items</h3>
          <button onClick={addItem} style={btn()}>+ Tambah Item</button>
        </div>

        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th()}>Nama</th>
                <th style={th()}>Qty</th>
                <th style={th()}>Harga</th>
                <th style={th()}>Total</th>
                <th style={th()}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td style={td()}>
                    <input
                      value={it.name}
                      onChange={(e) => setItem(i, { name: e.target.value })}
                      placeholder="Nama item"
                      style={input()}
                    />
                  </td>

                  <td style={td()}>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={it.qtyText}
                      onChange={(e) => onChangeQty(i, e.target.value)}
                      onBlur={() => onBlurQty(i)}
                      placeholder="Qty"
                      style={input()}
                    />
                  </td>

                  <td style={td()}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={it.priceText}
                      onChange={(e) => onChangePrice(i, e.target.value)}
                      onBlur={() => onBlurPrice(i)}
                      placeholder="Harga (contoh: 10.000)"
                      style={input()}
                    />
                  </td>

                  <td style={td()}>{rupiah(num(it.qty) * num(it.price))}</td>

                  <td style={td()}>
                    <button onClick={() => removeItem(i)} disabled={items.length === 1} style={miniBtnDanger()}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: 10, color: "#666" }}>
            Harga input pakai pemisah ribuan.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
      <span style={{ color: "#666" }}>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function card(): React.CSSProperties {
  return { border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white", boxSizing: "border-box" };
}
function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 13, color: "#444" };
}
function input(): React.CSSProperties {
  return { padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%", boxSizing: "border-box", outline: "none", background: "white" };
}
function btn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer", textDecoration: "none", color: "#111" };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", cursor: "pointer" };
}
function th(): React.CSSProperties {
  return { textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px", color: "#666", fontWeight: 600 };
}
function td(): React.CSSProperties {
  return { borderBottom: "1px solid #f2f2f2", padding: "8px 6px", verticalAlign: "top" };
}
function miniBtnDanger(): React.CSSProperties {
  return { padding: "6px 10px", borderRadius: 10, border: "1px solid #b00", background: "#fff5f5", cursor: "pointer" };
}
