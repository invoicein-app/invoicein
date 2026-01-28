// app/invoice/edit/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { num, rupiah } from "@/lib/money";

type Item = { id: string; name: string; qty: number; price: number; sort_order: number };

function digitsOnly(raw: string) {
  const clean = String(raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return clean === "" ? 0 : Number(clean);
}

export default function InvoiceEditPage() {
  const supabase = supabaseBrowser();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [inv, setInv] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");

    const { data: invData, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .single();

    if (invErr) {
      setMsg(invErr.message);
      setLoading(false);
      return;
    }

    const { data: itemData, error: itemErr } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .order("sort_order", { ascending: true });

    if (itemErr) {
      setMsg(itemErr.message);
      setLoading(false);
      return;
    }

    // pastikan value percent numeric
    invData.discount_value = Number(invData.discount_value ?? 0);
    invData.tax_value = Number(invData.tax_value ?? 0);

    setInv(invData);
    setItems((itemData || []) as any);
    setLoading(false);
  }

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  const calc = useMemo(() => {
    if (!inv) return { sub: 0, disc: 0, tax: 0, total: 0 };

    const sub = items.reduce((a, it) => a + num(it.qty) * num(it.price), 0);

    const discPct = Math.max(0, Math.min(100, Number(inv.discount_value ?? 0)));
    const disc = sub * (discPct / 100);

    const afterDisc = Math.max(0, sub - disc);

    const taxPct = Math.max(0, Math.min(100, Number(inv.tax_value ?? 0)));
    const tax = afterDisc * (taxPct / 100);

    return { sub, disc, tax, total: Math.max(0, afterDisc + tax) };
  }, [inv, items]);

  function patchInv(p: any) {
    setInv((prev: any) => ({ ...prev, ...p }));
  }

  function patchItem(i: number, p: Partial<Item>) {
    setItems((prev) => prev.map((x, idx) => (idx === i ? ({ ...x, ...p } as any) : x)));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, name: "", qty: 1, price: 0, sort_order: prev.length } as any,
    ]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setMsg("");
    if (!inv?.customer_name?.trim()) return setMsg("Customer name wajib diisi.");
    if (items.length === 0) return setMsg("Minimal 1 item.");
    if (items.some((it) => !String(it.name || "").trim())) return setMsg("Nama item tidak boleh kosong.");

    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          header: {
            invoice_date: inv.invoice_date,
            customer_name: inv.customer_name,
            customer_phone: inv.customer_phone || "",
            customer_address: inv.customer_address || "",
            note: inv.note || "",
            // ✅ percent-only
            discount_value: Number(inv.discount_value ?? 0),
            tax_value: Number(inv.tax_value ?? 0),
            // ❌ jangan kirim status biar gak kena enum mismatch
          },
          items: items.map((it, idx) => ({
            name: it.name,
            qty: Number(it.qty || 0),
            price: Number(it.price || 0),
            sort_order: idx,
          })),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Gagal simpan.");

      window.location.href = `/invoice/${id}`;
    } catch (e: any) {
      setMsg(e?.message || "Gagal simpan.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 18 }}>Loading...</div>;
  if (msg && !inv) return <div style={{ padding: 18, color: "#b00" }}>{msg}</div>;
  if (!inv) return <div style={{ padding: 18 }}>Invoice tidak ditemukan.</div>;

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Edit Invoice</h1>
          <p style={{ marginTop: 6, color: "#666" }}>{inv.invoice_number}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={`/invoice/${id}`} style={btn()}>Batal</a>
          <button onClick={save} disabled={saving} style={btnPrimary()}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={card()}>
          <h3 style={{ margin: 0 }}>Info</h3>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={label()}>
              Tanggal
              <input
                type="date"
                value={inv.invoice_date || ""}
                onChange={(e) => patchInv({ invoice_date: e.target.value })}
                style={input()}
              />
            </label>

            {/* Status masih ditampilkan kalau kamu mau, tapi tidak ikut dikirim */}
            <label style={label()}>
              Status (opsional)
              <select value={inv.status || ""} onChange={(e) => patchInv({ status: e.target.value })} style={input()}>
                <option value="draft">draft</option>
                <option value="sent">sent</option>
                <option value="paid">paid</option>
              </select>
            </label>

            <label style={label()}>
              Nama Customer
              <input value={inv.customer_name || ""} onChange={(e) => patchInv({ customer_name: e.target.value })} style={input()} />
            </label>

            <label style={label()}>
              No HP
              <input value={inv.customer_phone || ""} onChange={(e) => patchInv({ customer_phone: e.target.value })} style={input()} />
            </label>

            <label style={label()}>
              Alamat
              <textarea value={inv.customer_address || ""} onChange={(e) => patchInv({ customer_address: e.target.value })} style={{ ...input(), minHeight: 80 }} />
            </label>

            <label style={label()}>
              Catatan
              <textarea value={inv.note || ""} onChange={(e) => patchInv({ note: e.target.value })} style={{ ...input(), minHeight: 80 }} />
            </label>
          </div>
        </div>

        <div style={card()}>
          <h3 style={{ margin: 0 }}>Diskon & Pajak</h3>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={label()}>
              Diskon (%)
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(inv.discount_value ?? 0)}
                onChange={(e) => patchInv({ discount_value: Math.min(100, digitsOnly(e.target.value)) })}
                style={input()}
              />
            </label>

            <label style={label()}>
              Pajak (%)
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(inv.tax_value ?? 0)}
                onChange={(e) => patchInv({ tax_value: Math.min(100, digitsOnly(e.target.value)) })}
                style={input()}
              />
            </label>

            <div style={{ marginTop: 6, borderTop: "1px solid #eee", paddingTop: 10 }}>
              <Row k="Subtotal" v={rupiah(calc.sub)} />
              <Row k={`Diskon (${Math.max(0, Math.min(100, Number(inv.discount_value ?? 0)))}%)`} v={rupiah(calc.disc)} />
              <Row k={`Pajak (${Math.max(0, Math.min(100, Number(inv.tax_value ?? 0)))}%)`} v={rupiah(calc.tax)} />
              <Row k="Total" v={<b>{rupiah(calc.total)}</b>} />
            </div>

            {msg ? <p style={{ color: "#b00" }}>{msg}</p> : null}
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
                <tr key={it.id}>
                  <td style={td()}>
                    <input value={it.name} onChange={(e) => patchItem(i, { name: e.target.value })} style={input()} />
                  </td>
                  <td style={td()}>
                    <input type="number" value={it.qty} onChange={(e) => patchItem(i, { qty: Number(e.target.value) })} style={input()} />
                  </td>
                  <td style={td()}>
                    <input type="number" value={it.price} onChange={(e) => patchItem(i, { price: Number(e.target.value) })} style={input()} />
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

function card(): React.CSSProperties { return { border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white" }; }
function label(): React.CSSProperties { return { display: "grid", gap: 6, fontSize: 13, color: "#444" }; }
function input(): React.CSSProperties { return { padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%" }; }
function btn(): React.CSSProperties { return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer", textDecoration: "none", color: "#111" }; }
function btnPrimary(): React.CSSProperties { return { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", cursor: "pointer" }; }
function th(): React.CSSProperties { return { textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px", color: "#666", fontWeight: 600 }; }
function td(): React.CSSProperties { return { borderBottom: "1px solid #f2f2f2", padding: "8px 6px", verticalAlign: "top" }; }
function miniBtnDanger(): React.CSSProperties { return { padding: "6px 10px", borderRadius: 10, border: "1px solid #b00", background: "#fff5f5", cursor: "pointer" }; }