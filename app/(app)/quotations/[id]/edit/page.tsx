// ✅ FULL REPLACE
// invoiceku/app/(app)/quotations/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { num, rupiah } from "@/lib/money";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  price: number | null;
  is_active: boolean | null;
};

type Item = {
  id?: string; // quotation_items.id (optional)
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
function safeDateOrEmpty(v: any) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return "";
}

export default function QuotationEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProd, setLoadingProd] = useState(true);

  const [isLocked, setIsLocked] = useState(false);
  const [status, setStatus] = useState<string>("draft");
  const [quotationNumber, setQuotationNumber] = useState<string>("");

  const [quotationDate, setQuotationDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // ✅ discount type + value (biar konsisten sama invoice/new)
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmountText, setDiscountAmountText] = useState<string>("");
  const discountAmount = useMemo(() => digitsToNumber(discountAmountText), [discountAmountText]);

  // ✅ tax percent only
  const [taxPercent, setTaxPercent] = useState<number>(0);

  const [items, setItems] = useState<Item[]>([
    { product_id: "", name: "", qty: 1, qtyText: "1", price: 0, priceText: "" },
  ]);

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

  async function loadQuotation() {
    setLoading(true);
    setMsg("");

    try {
      // header
      const { data: q, error: qErr } = await supabase
        .from("quotations")
        .select(
          "id,quotation_number,quotation_date,customer_id,customer_name,customer_phone,customer_address,note,discount_type,discount_value,tax_value,status,is_locked"
        )
        .eq("id", id)
        .single();

      if (qErr || !q) throw new Error(qErr?.message || "Quotation not found");

      setQuotationNumber(String((q as any).quotation_number || ""));
      setQuotationDate(safeDateOrEmpty((q as any).quotation_date) || new Date().toISOString().slice(0, 10));

      setCustomerId(String((q as any).customer_id || ""));
      setCustomerName(String((q as any).customer_name || ""));
      setCustomerPhone(String((q as any).customer_phone || ""));
      setCustomerAddress(String((q as any).customer_address || ""));
      setNote(String((q as any).note || ""));

      const dtRaw = String((q as any).discount_type || "percent").toLowerCase();
      if (dtRaw === "amount" || dtRaw === "fixed") {
        setDiscountType("amount");
        setDiscountAmountText(formatThousandsID(Math.max(0, Math.floor(num((q as any).discount_value || 0)))));
        setDiscountPercent(0);
      } else {
        setDiscountType("percent");
        setDiscountPercent(clampPercent(num((q as any).discount_value || 0)));
        setDiscountAmountText("");
      }

      setTaxPercent(clampPercent(num((q as any).tax_value || 0)));

      setStatus(String((q as any).status || "draft"));
      setIsLocked(!!(q as any).is_locked);

      // items
      const { data: itRows, error: itErr } = await supabase
        .from("quotation_items")
        .select("id,product_id,name,qty,price,sort_order")
        .eq("quotation_id", id)
        .order("sort_order", { ascending: true });

      if (itErr) throw new Error(itErr.message);

      const mapped =
        (itRows || []).length > 0
          ? (itRows || []).map((x: any) => {
              const qtyN = Math.max(0, Math.floor(num(x.qty || 0)));
              const priceN = Math.max(0, Math.floor(num(x.price || 0)));
              return {
                id: String(x.id),
                product_id: String(x.product_id || ""),
                name: String(x.name || ""),
                qty: qtyN,
                qtyText: qtyN ? String(qtyN) : "",
                price: priceN,
                priceText: priceN ? formatThousandsID(priceN) : "",
              } as Item;
            })
          : [{ product_id: "", name: "", qty: 1, qtyText: "1", price: 0, priceText: "" }];

      setItems(mapped);
    } catch (e: any) {
      setMsg(e?.message || "Gagal load quotation.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    loadProducts();
    loadQuotation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const calc = useMemo(() => {
    const sub = items.reduce((a, it) => a + num(it.qty) * num(it.price), 0);

    let disc = 0;
    if (discountType === "percent") {
      disc = sub * (clampPercent(num(discountPercent)) / 100);
    } else {
      disc = Math.max(0, num(discountAmount));
    }
    if (disc > sub) disc = sub;

    const afterDisc = Math.max(0, sub - disc);
    const tax = afterDisc * (clampPercent(num(taxPercent)) / 100);
    const total = Math.max(0, afterDisc + tax);

    return { sub, disc, tax, total };
  }, [items, discountType, discountPercent, discountAmount, taxPercent]);

  function setItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { product_id: "", name: "", qty: 1, qtyText: "1", price: 0, priceText: "" },
    ]);
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
    setItem(rowIdx, { price: n, priceText: formatThousandsID(n), product_id: "" });
  }

  function onBlurPrice(rowIdx: number) {
    const it = items[rowIdx];
    const n = Math.max(0, Math.floor(num(it.price)));
    setItem(rowIdx, { price: n, priceText: formatThousandsID(n) });
  }

  async function save() {
    setMsg("");

    if (isLocked) return setMsg("Quotation ini sudah LOCKED, tidak bisa di-edit.");
    if (!customerName.trim()) return setMsg("Customer name wajib diisi.");
    if (items.length === 0) return setMsg("Minimal 1 item.");
    if (items.some((it) => !it.name.trim())) return setMsg("Nama item tidak boleh kosong.");

    setSaving(true);
    try {
      const payload: any = {
        quotation_date: quotationDate,
        customer_id: customerId || null,
        customer_name: customerName,
        customer_phone: customerPhone || "",
        customer_address: customerAddress || "",
        note: note || "",

        discount_type: discountType,
        discount_value:
          discountType === "percent"
            ? clampPercent(num(discountPercent))
            : Math.max(0, Math.floor(num(discountAmount))),

        tax_value: clampPercent(num(taxPercent)),

        items: items.map((it, idx) => ({
          product_id: it.product_id || null,
          name: String(it.name || ""),
          qty: Math.max(0, Math.floor(num(it.qty))),
          price: Math.max(0, Math.floor(num(it.price))),
          sort_order: idx,
        })),
      };

      const res = await fetch(`/api/quotations/update/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) return setMsg(json?.error || `Gagal simpan (${res.status})`);

      setMsg("Berhasil disimpan ✅");
      await loadQuotation();
    } catch (e: any) {
      setMsg(e?.message || "Gagal simpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>
            Edit Quotation {quotationNumber ? <span style={{ fontFamily: "ui-monospace" }}>{quotationNumber}</span> : ""}
          </h1>
          <p style={{ marginTop: 6, color: "#666" }}>
            Status: <b>{status}</b> {isLocked ? "• (LOCKED)" : ""}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/quotations")} style={btn()}>
            Kembali
          </button>

          <button onClick={save} disabled={saving || loading || isLocked} style={btnPrimary()}>
            {saving ? "Menyimpan..." : isLocked ? "Locked" : "Simpan Perubahan"}
          </button>
        </div>
      </div>

      {msg ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fff" }}>
          <span style={{ color: msg.includes("✅") ? "#065f46" : "#b00", fontWeight: 800 }}>{msg}</span>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={card()}>
          <h3 style={{ margin: 0 }}>Info Quotation</h3>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={label()}>
              Tanggal
              <input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                style={input()}
                disabled={isLocked}
              />
            </label>

            <label style={label()}>
              Nama Customer (wajib)
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={input()} disabled={isLocked} />
            </label>

            <label style={label()}>
              No HP
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={input()} disabled={isLocked} />
            </label>

            <label style={label()}>
              Alamat Customer
              <textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                style={{ ...input(), minHeight: 80 }}
                disabled={isLocked}
              />
            </label>

            <label style={label()}>
              Catatan
              <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input(), minHeight: 80 }} disabled={isLocked} />
            </label>
          </div>
        </div>

        <div style={card()}>
          <h3 style={{ margin: 0 }}>Diskon & Pajak</h3>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={label()}>
              Diskon Tipe
              <select
                value={discountType}
                onChange={(e) => {
                  const v = (e.target.value as any) || "percent";
                  setDiscountType(v);
                  if (v === "percent") setDiscountAmountText("");
                  if (v === "amount") setDiscountPercent(0);
                }}
                style={input()}
                disabled={isLocked}
              >
                <option value="percent">Percent (%)</option>
                <option value="amount">Amount (Rp)</option>
              </select>
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
                  disabled={isLocked}
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
                  placeholder="contoh: 50.000"
                  style={input()}
                  disabled={isLocked}
                />
              </label>
            )}

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
                disabled={isLocked}
              />
              <small style={{ color: "#666" }}>Pajak dihitung setelah diskon.</small>
            </label>

            <div style={{ marginTop: 6, borderTop: "1px solid #eee", paddingTop: 10 }}>
              <Row k="Subtotal" v={rupiah(calc.sub)} />
              <Row k="Diskon" v={rupiah(calc.disc)} />
              <Row k="Pajak" v={rupiah(calc.tax)} />
              <Row k="Total" v={<b>{rupiah(calc.total)}</b>} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, ...card() }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Items</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/products" style={btn()}>
              + Kelola Barang
            </a>
            <button onClick={addItem} style={btn()} disabled={isLocked}>
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
                <tr key={it.id ? it.id : `${id}-${i}`}>
                  <td style={td()}>
                    <select
                      value={it.product_id || ""}
                      onChange={(e) => onPickProduct(i, e.target.value)}
                      style={input()}
                      disabled={isLocked}
                    >
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
                      disabled={isLocked}
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
                      disabled={isLocked}
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
                        placeholder="Harga"
                        style={input()}
                        disabled={isLocked}
                      />
                      <small style={{ color: "#666" }}>{it.price > 0 ? `Rp ${it.price.toLocaleString("id-ID")}` : " "}</small>
                    </div>
                  </td>

                  <td style={td()}>{rupiah(num(it.qty) * num(it.price))}</td>

                  <td style={td()}>
                    <button onClick={() => removeItem(i)} disabled={isLocked || items.length === 1} style={miniBtnDanger()}>
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

      {loading ? <p style={{ marginTop: 14, color: "#666" }}>Loading...</p> : null}
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
