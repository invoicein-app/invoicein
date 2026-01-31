// ✅ FULL REPLACE FILE
// app/(app)/quotations/new/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { num, rupiah } from "@/lib/money";

type Customer = { id: string; name: string; phone: string; address: string };
type Product = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  price: number | null;
  is_active: boolean | null;
};

type DiscountType = "percent" | "amount";

type Item = {
  product_id?: string;
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

function clampPercent(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.floor(n);
}

function clampMoney(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  return Math.floor(n);
}

export default function QuotationNewPage() {
  const supabase = supabaseBrowser();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCust, setLoadingCust] = useState(true);
  const [loadingProd, setLoadingProd] = useState(true);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [quotationDate, setQuotationDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const [note, setNote] = useState("");

  // ✅ Discount: percent OR amount (default percent)
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmountText, setDiscountAmountText] = useState<string>("");
  const discountAmount = useMemo(() => clampMoney(digitsToNumber(discountAmountText)), [discountAmountText]);

  // ✅ Tax: percent-only (Indonesia style)
  const [taxPercent, setTaxPercent] = useState<number>(0);

  const [items, setItems] = useState<Item[]>([
    { product_id: "", name: "", qty: 1, qtyText: "1", price: 0, priceText: "" },
  ]);

  async function loadCustomers() {
    setLoadingCust(true);
    const { data } = await supabase.from("customers").select("id,name,phone,address").order("created_at", { ascending: false });
    setCustomers((data || []) as any);
    setLoadingCust(false);
  }

  async function loadProducts() {
    setLoadingProd(true);
    const { data } = await supabase
      .from("products")
      .select("id,name,sku,unit,price,is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setProducts((data || []) as any);
    setLoadingProd(false);
  }

  useEffect(() => {
    loadCustomers();
    loadProducts();
  }, []);

  useEffect(() => {
    if (!customerId) return;
    const c = customers.find((x) => x.id === customerId);
    if (!c) return;
    setCustomerName(c.name);
    setCustomerPhone(c.phone || "");
    setCustomerAddress(c.address || "");
  }, [customerId, customers]);

  const calc = useMemo(() => {
    const sub = items.reduce((a, it) => a + num(it.qty) * num(it.price), 0);

    let disc = 0;
    const discPct = clampPercent(num(discountPercent));
    if (discountType === "percent") disc = sub * (discPct / 100);
    if (discountType === "amount") disc = Math.min(sub, clampMoney(discountAmount));

    const afterDisc = Math.max(0, sub - disc);

    const taxPct = clampPercent(num(taxPercent));
    const tax = afterDisc * (taxPct / 100);
    const total = Math.max(0, afterDisc + tax);

    return { sub, disc, tax, total, discPct, taxPct };
  }, [items, discountType, discountPercent, discountAmount, taxPercent]);

  function setItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function addItem() {
    setItems((prev) => [...prev, { product_id: "", name: "", qty: 1, qtyText: "1", price: 0, priceText: "" }]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onPickProduct(rowIdx: number, productId: string) {
    if (!productId) {
      setItem(rowIdx, { product_id: "", name: "", price: 0, priceText: "" });
      return;
    }

    const p = products.find((x) => x.id === productId);
    if (!p) return;

    const pPrice = Math.max(0, Math.floor(Number(p.price || 0)));

    setItem(rowIdx, {
      product_id: p.id,
      name: p.name,
      price: pPrice,
      priceText: formatThousandsID(pPrice),
    });
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
    const formatted = formatThousandsID(n);

    setItem(rowIdx, {
      product_id: "",
      price: n,
      priceText: formatted,
    });
  }

  function onBlurPrice(rowIdx: number) {
    const it = items[rowIdx];
    const n = Math.max(0, Math.floor(num(it.price)));
    setItem(rowIdx, { price: n, priceText: formatThousandsID(n) });
  }

  async function save() {
    setMsg("");

    if (!customerName.trim()) return setMsg("Customer name wajib diisi.");
    if (items.length === 0) return setMsg("Minimal 1 item.");
    if (items.some((it) => !it.name.trim())) return setMsg("Nama item tidak boleh kosong.");

    setSaving(true);
    try {
      // ✅ DB payload rules:
      // - discount_type: 'percent' | 'amount'  (default percent)
      // - discount_value: number  (percent 0..100 OR amount in Rupiah)
      // - tax_value: percent-only 0..100
      const discount_value =
        discountType === "percent" ? clampPercent(num(discountPercent)) : clampMoney(discountAmount);

      const payload: any = {
        quotation_date: quotationDate,
        customer_id: customerId || null,
        customer_name: customerName,
        customer_phone: customerPhone || "",
        customer_address: customerAddress || "",
        note: note || "",

        discount_type: discountType, // ✅ NEW
        discount_value, // ✅ NEW (depends on type)
        tax_value: clampPercent(num(taxPercent)), // ✅ percent-only

        items: items.map((it) => ({
          product_id: it.product_id || null,
          name: String(it.name || ""),
          qty: Math.max(0, Math.floor(num(it.qty))),
          price: Math.max(0, Math.floor(num(it.price))),
        })),
      };

      const res = await fetch("/api/quotations/create", {
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

      window.location.href = `/quotations/${json.id}`;
    } catch (e: any) {
      setMsg(e?.message || "Gagal simpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Quotation Baru</h1>
          <p style={{ marginTop: 6, color: "#666" }}>Simpan dulu, nanti bisa convert jadi Invoice</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/quotations" style={btn()}>
            Kembali
          </a>
          <button onClick={save} disabled={saving} style={btnPrimary()}>
            {saving ? "Menyimpan..." : "Simpan Quotation"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={card()}>
          <h3 style={{ margin: 0 }}>Info Quotation</h3>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={label()}>
              Tanggal
              <input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Pilih Customer (optional)
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={input()}>
                <option value="">- manual -</option>
                {(customers || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
              {loadingCust ? <small style={{ color: "#666" }}>Loading customer...</small> : null}
            </label>

            <label style={label()}>
              Nama Customer (wajib)
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              No HP
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Alamat Customer (tersimpan di quotation)
              <textarea value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} style={{ ...input(), minHeight: 80 }} />
            </label>

            <label style={label()}>
              Catatan
              <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input(), minHeight: 80 }} />
            </label>
          </div>
        </div>

        <div style={card()}>
          <h3 style={{ margin: 0 }}>Diskon & Pajak</h3>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {/* ✅ Discount type toggle */}
            <label style={label()}>
              Jenis Diskon
              <select
                value={discountType}
                onChange={(e) => setDiscountType((e.target.value as DiscountType) || "percent")}
                style={input()}
              >
                <option value="percent">Persentase (%)</option>
                <option value="amount">Nominal (Rp)</option>
              </select>
              <small style={{ color: "#666" }}>Default: persentase. Nominal dipotong dari subtotal.</small>
            </label>

            {discountType === "percent" ? (
              <label style={label()}>
                Diskon (%)
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={discountPercent ? String(discountPercent) : ""}
                  onChange={(e) => setDiscountPercent(clampPercent(digitsToNumber(e.target.value)))}
                  placeholder="0–100"
                  style={input()}
                />
              </label>
            ) : (
              <label style={label()}>
                Diskon (Rp)
                <input
                  type="text"
                  inputMode="numeric"
                  value={discountAmountText}
                  onChange={(e) => setDiscountAmountText(formatThousandsID(digitsToNumber(e.target.value)))}
                  placeholder="contoh: 10.000"
                  style={input()}
                />
              </label>
            )}

            {/* ✅ Tax percent only */}
            <label style={label()}>
              Pajak (%)
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={taxPercent ? String(taxPercent) : ""}
                onChange={(e) => setTaxPercent(clampPercent(digitsToNumber(e.target.value)))}
                placeholder="0–100"
                style={input()}
              />
              <small style={{ color: "#666" }}>Pajak dihitung setelah diskon.</small>
            </label>

            <div style={{ marginTop: 6, borderTop: "1px solid #eee", paddingTop: 10 }}>
              <Row k="Subtotal" v={rupiah(calc.sub)} />
              <Row
                k={discountType === "percent" ? `Diskon (${calc.discPct}%)` : "Diskon (Rp)"}
                v={rupiah(calc.disc)}
              />
              <Row k={`Pajak (${calc.taxPct}%)`} v={rupiah(calc.tax)} />
              <Row k="Total" v={<b>{rupiah(calc.total)}</b>} />
            </div>

            {msg ? <p style={{ color: "#b00" }}>{msg}</p> : null}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, ...card() }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Items</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/products" style={btn()}>
              + Kelola Barang
            </a>
            <button onClick={addItem} style={btn()}>
              + Tambah Item
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th()}>Pilih Barang</th>
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
                    <select value={it.product_id || ""} onChange={(e) => onPickProduct(i, e.target.value)} style={input()}>
                      <option value="">- manual -</option>
                      {(products || []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.sku ? ` • ${p.sku}` : ""}
                          {p.unit ? ` (${p.unit})` : ""}
                        </option>
                      ))}
                    </select>
                    {loadingProd ? <small style={{ color: "#666" }}>Loading barang...</small> : null}
                  </td>

                  <td style={td()}>
                    <input
                      value={it.name}
                      onChange={(e) => setItem(i, { name: e.target.value, product_id: "" })}
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
                    <div style={{ display: "grid", gap: 6 }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={it.priceText}
                        onChange={(e) => onChangePrice(i, e.target.value)}
                        onBlur={() => onBlurPrice(i)}
                        placeholder="Harga (contoh: 10.000)"
                        style={input()}
                      />
                      <small style={{ color: "#666" }}>{it.price > 0 ? `Rp ${it.price.toLocaleString("id-ID")}` : " "}</small>
                    </div>
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
            Kalau pilih barang dari daftar, nama + harga otomatis keisi. Harga input pakai pemisah ribuan.
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
  return {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 14,
    background: "white",
    boxSizing: "border-box",
  };
}
function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 13, color: "#444" };
}
function input(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ddd",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    background: "white",
  };
}
function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "white",
    cursor: "pointer",
    textDecoration: "none",
    color: "#111",
  };
}
function btnPrimary(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "white",
    cursor: "pointer",
  };
}
function th(): React.CSSProperties {
  return {
    textAlign: "left",
    borderBottom: "1px solid #eee",
    padding: "8px 6px",
    color: "#666",
    fontWeight: 600,
  };
}
function td(): React.CSSProperties {
  return { borderBottom: "1px solid #f2f2f2", padding: "8px 6px", verticalAlign: "top" };
}
function miniBtnDanger(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #b00",
    background: "#fff5f5",
    cursor: "pointer",
  };
}
