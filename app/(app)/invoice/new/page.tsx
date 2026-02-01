// ✅ FULL REPLACE
// invoiceku/app/(app)/invoice/new/page.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { num, rupiah } from "@/lib/money";
import { useSearchParams } from "next/navigation";

type Customer = { id: string; name: string; phone: string; address: string };
type Product = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  price: number | null;
  is_active: boolean | null;
};

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

type PrefillData = {
  quotation_id: string;
  quotation_number: string | null;
  quotation_date: string | null;

  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  note: string;

  discount_type: "percent" | "amount";
  discount_value: number;

  tax_value: number; // percent-only

  items: Array<{
    product_id: string | null;
    name: string;
    qty: number;
    price: number;
    sort_order: number;
  }>;
};

// ✅ Inner component: useSearchParams() DI SINI (wajib dalam Suspense)
function InvoiceNewInner() {
  const supabase = supabaseBrowser();
  const sp = useSearchParams();

  // ✅ support 2 versi param biar aman
  const fromQuotationId = String(sp.get("fromQuotation") || sp.get("fromQuotationId") || "").trim();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCust, setLoadingCust] = useState(true);
  const [loadingProd, setLoadingProd] = useState(true);

  const [saving, setSaving] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [msg, setMsg] = useState("");

  const [invoiceDate, setInvoiceDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // ✅ Due date + terms
  const [dueDate, setDueDate] = useState<string>(() => "");
  const [termsDays, setTermsDays] = useState<number>(14);

  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const [note, setNote] = useState("");

  // ✅ DISCOUNT: type + value
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountPercent, setDiscountPercent] = useState<number>(0); // percent
  const [discountAmountText, setDiscountAmountText] = useState<string>(""); // amount input text
  const discountAmount = useMemo(() => digitsToNumber(discountAmountText), [discountAmountText]);

  // ✅ TAX fix percent only
  const [taxPercent, setTaxPercent] = useState<number>(0);

  const [items, setItems] = useState<Item[]>([
    { product_id: "", name: "", qty: 1, qtyText: "1", price: 0, priceText: "" },
  ]);

  // pointer quotation (optional)
  const [sourceQuotationId, setSourceQuotationId] = useState<string>("");

  function applyTerms(days: number) {
    const d = Math.max(0, Math.floor(num(days)));
    setTermsDays(d);

    const base = new Date(invoiceDate);
    if (Number.isNaN(base.getTime())) return;

    const next = new Date(base);
    next.setDate(next.getDate() + d);
    setDueDate(next.toISOString().slice(0, 10));
  }

  useEffect(() => {
    applyTerms(termsDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!invoiceDate) return;
    applyTerms(termsDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceDate]);

  async function loadCustomers() {
    setLoadingCust(true);
    const { data } = await supabase
      .from("customers")
      .select("id,name,phone,address")
      .order("created_at", { ascending: false });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // discount
    let disc = 0;
    if (discountType === "percent") {
      const discPct = clampPercent(num(discountPercent));
      disc = sub * (discPct / 100);
    } else {
      disc = Math.max(0, num(discountAmount));
    }
    if (disc > sub) disc = sub;

    const afterDisc = Math.max(0, sub - disc);

    const taxPct = clampPercent(num(taxPercent));
    const tax = afterDisc * (taxPct / 100);

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
    const formatted = formatThousandsID(n);
    setItem(rowIdx, { product_id: "", price: n, priceText: formatted });
  }

  function onBlurPrice(rowIdx: number) {
    const it = items[rowIdx];
    const n = Math.max(0, Math.floor(num(it.price)));
    setItem(rowIdx, { price: n, priceText: formatThousandsID(n) });
  }

  // ✅ PREFILL: pakai API convert (single source of truth)
  async function prefillFromQuotation(qid: string) {
    if (!qid) return;
    setPrefilling(true);
    try {
      setMsg("");

      const res = await fetch(`/api/quotations/convert/${qid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || `Gagal prefill (${res.status})`);

      // kalau udah ada invoice, langsung buka invoice itu
      if (json?.invoice_id) {
        window.location.href = `/invoice/${json.invoice_id}`;
        return;
      }

      if (!json?.prefill || !json?.prefill_data) {
        throw new Error("Prefill data kosong dari server.");
      }

      const p: PrefillData = json.prefill_data as any;

      // customer + note
      setCustomerId(p.customer_id || "");
      setCustomerName(p.customer_name || "");
      setCustomerPhone(p.customer_phone || "");
      setCustomerAddress(p.customer_address || "");
      setNote(p.note || "");

      // pointer
      setSourceQuotationId(p.quotation_id);

      // discount
      if (p.discount_type === "amount") {
        setDiscountType("amount");
        setDiscountAmountText(formatThousandsID(Math.max(0, Math.floor(num(p.discount_value || 0)))));
        setDiscountPercent(0);
      } else {
        setDiscountType("percent");
        setDiscountPercent(clampPercent(num(p.discount_value || 0)));
        setDiscountAmountText("");
      }

      // tax percent only
      setTaxPercent(clampPercent(num(p.tax_value || 0)));

      // items
      const mappedItems =
        (p.items || []).length > 0
          ? (p.items || []).map((x) => {
              const qtyN = Math.max(0, Math.floor(num(x.qty || 0)));
              const priceN = Math.max(0, Math.floor(num(x.price || 0)));
              return {
                product_id: x.product_id || "",
                name: String(x.name || ""),
                qty: qtyN,
                qtyText: qtyN ? String(qtyN) : "",
                price: priceN,
                priceText: priceN ? formatThousandsID(priceN) : "",
              } as Item;
            })
          : [{ product_id: "", name: "", qty: 1, qtyText: "1", price: 0, priceText: "" }];

      setItems(mappedItems);

      setMsg("Prefill dari quotation berhasil. Silakan cek & edit (isi due date) sebelum simpan.");
    } catch (e: any) {
      setMsg(e?.message || "Gagal prefill dari quotation.");
    } finally {
      setPrefilling(false);
    }
  }

  useEffect(() => {
    if (!fromQuotationId) return;
    prefillFromQuotation(fromQuotationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromQuotationId]);

  async function save() {
    setMsg("");

    if (prefilling) return setMsg("Tunggu prefill selesai dulu ya.");
    if (!customerName.trim()) return setMsg("Customer name wajib diisi.");
    if (items.length === 0) return setMsg("Minimal 1 item.");
    if (items.some((it) => !it.name.trim())) return setMsg("Nama item tidak boleh kosong.");

    setSaving(true);
    try {
      const payload: any = {
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        quotation_id: sourceQuotationId || null,

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

        items: items.map((it) => ({
          name: String(it.name || ""),
          qty: Math.max(0, Math.floor(num(it.qty))),
          price: Math.max(0, Math.floor(num(it.price))),
        })),
      };

      const res = await fetch("/api/invoice/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) return setMsg(json?.error || `Gagal simpan (${res.status})`);

      window.location.href = `/invoice/${json.id}`;
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
          <h1 style={{ margin: 0 }}>Invoice Baru</h1>
          <p style={{ marginTop: 6, color: "#666" }}>Simpan dulu, nanti bisa view & download PDF</p>

          {fromQuotationId ? (
            <p style={{ marginTop: 6, color: "#111", fontWeight: 700 }}>
              Prefill dari Quotation:{" "}
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                {fromQuotationId.slice(0, 8)}...
              </span>
              {prefilling ? <span style={{ marginLeft: 8, color: "#666" }}>loading...</span> : null}
            </p>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <a href="/invoice" style={btn()}>
            Kembali
          </a>
          <button onClick={save} disabled={saving || prefilling} style={btnPrimary()}>
            {saving ? "Menyimpan..." : prefilling ? "Prefilling..." : "Simpan Invoice"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={card()}>
          <h3 style={{ margin: 0 }}>Info Invoice</h3>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={label()}>
              Tanggal
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} style={input()} />
            </label>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={label()}>
                Due Date
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={input()} />
              </label>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => applyTerms(7)} style={pillBtn(termsDays === 7)}>
                  Terms 7 hari
                </button>
                <button type="button" onClick={() => applyTerms(14)} style={pillBtn(termsDays === 14)}>
                  Terms 14 hari
                </button>
                <button type="button" onClick={() => applyTerms(30)} style={pillBtn(termsDays === 30)}>
                  Terms 30 hari
                </button>
              </div>
              <small style={{ color: "#666" }}>Klik terms untuk otomatis hitung due date dari tanggal invoice.</small>
            </div>

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
              Alamat Customer (tersimpan di invoice)
              <textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                style={{ ...input(), minHeight: 80, resize: "vertical" }}
              />
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
                />
                <small style={{ color: "#666" }}>Diskon dihitung dari subtotal.</small>
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
                />
                <small style={{ color: "#666" }}>Diskon fixed amount (rupiah).</small>
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
              />
              <small style={{ color: "#666" }}>Pajak dihitung setelah diskon (percent only).</small>
            </label>

            <div style={{ marginTop: 6, borderTop: "1px solid #eee", paddingTop: 10 }}>
              <Row k="Subtotal" v={rupiah(calc.sub)} />
              <Row k="Diskon" v={rupiah(calc.disc)} />
              <Row k="Pajak" v={rupiah(calc.tax)} />
              <Row k="Total" v={<b>{rupiah(calc.total)}</b>} />
            </div>

            {msg ? <p style={{ color: "#b00", margin: 0 }}>{msg}</p> : null}
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

export default function InvoiceNewPage() {
  // ✅ FIX Vercel: useSearchParams wajib di dalam Suspense
  return (
    <Suspense fallback={<div style={{ padding: 18 }}>Loading...</div>}>
      <InvoiceNewInner />
    </Suspense>
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
function pillBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid #ddd",
    background: active ? "#111" : "white",
    color: active ? "white" : "#111",
    cursor: "pointer",
    fontWeight: 700,
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
