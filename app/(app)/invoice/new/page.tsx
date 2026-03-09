"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { num, rupiah } from "@/lib/money";
import { useSearchParams } from "next/navigation";

type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
};

type Product = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  price: number | null;
  is_active: boolean | null;
};

type Warehouse = {
  id: string;
  name: string;
};

type BalanceRow = {
  item_key: string;
  item_name: string | null;
  product_id: string | null;
  on_hand: number;
};

type Item = {
  product_id: string;
  name: string;
  item_key: string;
  qty: number;
  price: number;
  qtyText: string;
  priceText: string;
  openSug?: boolean;
};

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
  tax_value: number;
  items: Array<{
    product_id: string | null;
    name: string;
    qty: number;
    price: number;
    sort_order: number;
  }>;
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

function toKey(raw: string) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "";
}

function productToItemKey(p: Pick<Product, "sku" | "name">) {
  const sku = String(p.sku || "").trim();
  if (sku) return toKey(sku);
  return toKey(String(p.name || ""));
}

function InvoiceNewInner() {
  const supabase = supabaseBrowser();
  const sp = useSearchParams();

  const fromQuotationId = String(
    sp.get("fromQuotation") || sp.get("fromQuotationId") || ""
  ).trim();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [balancesMap, setBalancesMap] = useState<Record<string, number>>({});
  const [warehouseProductIds, setWarehouseProductIds] = useState<Set<string>>(new Set());

  const [loadingCust, setLoadingCust] = useState(true);
  const [loadingProd, setLoadingProd] = useState(true);
  const [loadingWh, setLoadingWh] = useState(true);
  const [loadingBalances, setLoadingBalances] = useState(false);

  const [saving, setSaving] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [msg, setMsg] = useState("");

  const [orgId, setOrgId] = useState<string>("");

  const [invoiceDate, setInvoiceDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState<string>("");
  const [termsDays, setTermsDays] = useState<number>(14);

  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const [warehouseId, setWarehouseId] = useState<string>("");

  const [note, setNote] = useState("");

  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmountText, setDiscountAmountText] = useState<string>("");
  const discountAmount = useMemo(
    () => digitsToNumber(discountAmountText),
    [discountAmountText]
  );

  const [taxPercent, setTaxPercent] = useState<number>(0);

  const [items, setItems] = useState<Item[]>([
    {
      product_id: "",
      name: "",
      item_key: "",
      qty: 1,
      qtyText: "1",
      price: 0,
      priceText: "",
      openSug: false,
    },
  ]);

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
  }, []);

  useEffect(() => {
    if (!invoiceDate) return;
    applyTerms(termsDays);
  }, [invoiceDate]);

  async function loadCustomers() {
    setLoadingCust(true);
    const { data, error } = await supabase
      .from("customers")
      .select("id,name,phone,address")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadCustomers error:", error);
      setCustomers([]);
    } else {
      setCustomers((data || []) as any);
    }
    setLoadingCust(false);
  }

  async function loadProducts() {
    setLoadingProd(true);

    const { data, error } = await supabase
      .from("products")
      .select("id,name,sku,unit,price,is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadProducts error:", error);
      setProducts([]);
      setLoadingProd(false);
      return;
    }

    setProducts((data || []) as any);
    setLoadingProd(false);
  }

  async function loadWarehouses() {
    setLoadingWh(true);

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      setLoadingWh(false);
      return;
    }

    const { data: mem, error: memErr } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (memErr) {
      console.error("load membership error:", memErr);
      setLoadingWh(false);
      return;
    }

    const nextOrgId = String((mem as any)?.org_id || "");
    setOrgId(nextOrgId);

    if (!nextOrgId) {
      setLoadingWh(false);
      return;
    }

    const { data: wh, error: whErr } = await supabase
      .from("warehouses")
      .select("id,name")
      .eq("org_id", nextOrgId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (whErr) {
      console.error("loadWarehouses error:", whErr);
      setWarehouses([]);
    } else {
      setWarehouses(((wh || []) as any) as Warehouse[]);
    }

    setLoadingWh(false);
  }

  async function loadBalancesForWarehouse(nextWarehouseId: string) {
    if (!orgId || !nextWarehouseId) {
      setBalancesMap({});
      setWarehouseProductIds(new Set());
      return;
    }

    setLoadingBalances(true);
    try {
      const { data, error } = await supabase
        .from("inventory_balances")
        .select("item_key,item_name,product_id,on_hand")
        .eq("org_id", orgId)
        .eq("warehouse_id", nextWarehouseId)
        .limit(3000);

      if (error) throw error;

      const map: Record<string, number> = {};
      const productIds = new Set<string>();

      ((data || []) as BalanceRow[]).forEach((r) => {
        const key = String(r.item_key || "").trim().toLowerCase();
        if (key) {
          map[key] = Math.floor(num(r.on_hand));
        }

        const pid = String(r.product_id || "").trim();
        if (pid && Math.floor(num(r.on_hand)) > 0) {
          productIds.add(pid);
        }
      });

      setBalancesMap(map);
      setWarehouseProductIds(productIds);
    } catch (e) {
      console.error("loadBalancesForWarehouse error:", e);
      setBalancesMap({});
      setWarehouseProductIds(new Set());
    } finally {
      setLoadingBalances(false);
    }
  }

  useEffect(() => {
    loadCustomers();
    loadProducts();
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (!customerId) return;
    const c = customers.find((x) => x.id === customerId);
    if (!c) return;
    setCustomerName(c.name);
    setCustomerPhone(c.phone || "");
    setCustomerAddress(c.address || "");
  }, [customerId, customers]);

  useEffect(() => {
    loadBalancesForWarehouse(warehouseId);
  }, [warehouseId, orgId]);

  useEffect(() => {
    if (!warehouseId) return;

    setItems((prev) =>
      prev.map((it) => {
        if (!it.product_id) return it;
        if (warehouseProductIds.has(it.product_id)) return it;

        return {
          ...it,
          product_id: "",
          name: "",
          item_key: "",
          qty: 1,
          qtyText: "1",
          price: 0,
          priceText: "",
          openSug: false,
        };
      })
    );
  }, [warehouseId, warehouseProductIds]);

  const calc = useMemo(() => {
    const sub = items.reduce((a, it) => a + num(it.qty) * num(it.price), 0);

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
      {
        product_id: "",
        name: "",
        item_key: "",
        qty: 1,
        qtyText: "1",
        price: 0,
        priceText: "",
        openSug: false,
      },
    ]);
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

  const availableProducts = useMemo(() => {
    if (!warehouseId) return products;
    return products.filter((p) => warehouseProductIds.has(String(p.id || "")));
  }, [products, warehouseId, warehouseProductIds]);

  function getSuggestionsFor(raw: string) {
    const s = String(raw || "").trim().toLowerCase();
    const list = availableProducts || [];

    if (!s) return list.slice(0, 10);

    return list
      .filter((p) =>
        `${p.name} ${p.sku || ""} ${p.unit || ""}`.toLowerCase().includes(s)
      )
      .slice(0, 10);
  }

  function getStockHint(itemKey: string) {
    const key = String(itemKey || "").trim().toLowerCase();
    if (!key) return undefined;
    return balancesMap[key];
  }

  function pickSuggestion(rowIdx: number, p: Product) {
    const priceN = Math.max(0, Math.floor(Number(p.price || 0)));
    const itemKey = productToItemKey(p);

    setItems((prev) =>
      prev.map((it, idx) =>
        idx === rowIdx
          ? {
              ...it,
              product_id: p.id,
              name: String(p.name || ""),
              item_key: itemKey,
              price: priceN,
              priceText: priceN ? formatThousandsID(priceN) : "",
              openSug: false,
            }
          : it
      )
    );
  }

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

      if (json?.invoice_id) {
        window.location.href = `/invoice/${json.invoice_id}`;
        return;
      }

      if (!json?.prefill || !json?.prefill_data) {
        throw new Error("Prefill data kosong dari server.");
      }

      const p: PrefillData = json.prefill_data as any;

      setCustomerId(p.customer_id || "");
      setCustomerName(p.customer_name || "");
      setCustomerPhone(p.customer_phone || "");
      setCustomerAddress(p.customer_address || "");
      setNote(p.note || "");
      setSourceQuotationId(p.quotation_id || "");

      if (p.discount_type === "amount") {
        setDiscountType("amount");
        setDiscountAmountText(
          formatThousandsID(Math.max(0, Math.floor(num(p.discount_value || 0))))
        );
        setDiscountPercent(0);
      } else {
        setDiscountType("percent");
        setDiscountPercent(clampPercent(num(p.discount_value || 0)));
        setDiscountAmountText("");
      }

      setTaxPercent(clampPercent(num(p.tax_value || 0)));

      const mappedItems: Item[] =
        (p.items || []).length > 0
          ? (p.items || []).map((x) => ({
              product_id: x.product_id || "",
              name: String(x.name || ""),
              item_key: "",
              qty: Math.max(0, Math.floor(num(x.qty || 0))),
              qtyText: String(Math.max(0, Math.floor(num(x.qty || 0))) || ""),
              price: Math.max(0, Math.floor(num(x.price || 0))),
              priceText: formatThousandsID(Math.max(0, Math.floor(num(x.price || 0)))),
              openSug: false,
            }))
          : [
              {
                product_id: "",
                name: "",
                item_key: "",
                qty: 1,
                qtyText: "1",
                price: 0,
                priceText: "",
                openSug: false,
              },
            ];

      const normalized = mappedItems.map((it) => {
        if (!it.product_id) {
          return { ...it, item_key: "" };
        }

        const prod = products.find((p2) => p2.id === it.product_id);
        if (!prod) {
          return { ...it, item_key: "" };
        }

        return {
          ...it,
          name: prod.name,
          item_key: productToItemKey(prod),
        };
      });

      setItems(normalized);
      setMsg(
        "Prefill dari quotation berhasil. Cek item yang belum linked ke product sebelum simpan."
      );
    } catch (e: any) {
      setMsg(e?.message || "Gagal prefill dari quotation.");
    } finally {
      setPrefilling(false);
    }
  }

  useEffect(() => {
    if (!fromQuotationId) return;
    if (products.length === 0) return;
    prefillFromQuotation(fromQuotationId);
  }, [fromQuotationId, products.length]);

  async function save() {
    setMsg("");

    if (prefilling) {
      setMsg("Tunggu prefill selesai dulu ya.");
      return;
    }

    if (!customerName.trim()) {
      setMsg("Customer name wajib diisi.");
      return;
    }

    if (items.length === 0) {
      setMsg("Minimal 1 item.");
      return;
    }

    const badIdx = items.findIndex(
      (it) =>
        !String(it.product_id || "").trim() ||
        !String(it.item_key || "").trim() ||
        !String(it.name || "").trim()
    );

    if (badIdx >= 0) {
      setMsg(`Item baris ${badIdx + 1} wajib pilih dari master barang.`);
      return;
    }

    if (warehouseId) {
      const wrongWarehouseIdx = items.findIndex(
        (it) => !warehouseProductIds.has(String(it.product_id || ""))
      );

      if (wrongWarehouseIdx >= 0) {
        setMsg(`Item baris ${wrongWarehouseIdx + 1} tidak tersedia di gudang yang dipilih.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        quotation_id: sourceQuotationId || null,

        customer_id: customerId || null,
        customer_name: customerName,
        customer_phone: customerPhone || "",
        customer_address: customerAddress || "",
        note: note || "",

        warehouse_id: warehouseId || null,

        discount_type: discountType,
        discount_value:
          discountType === "percent"
            ? clampPercent(num(discountPercent))
            : Math.max(0, Math.floor(num(discountAmount))),
        tax_value: clampPercent(num(taxPercent)),

        items: items.map((it) => ({
          product_id: it.product_id,
          name: String(it.name || "").trim(),
          item_key: String(it.item_key || "").trim(),
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
      if (!res.ok) {
        setMsg(json?.error || `Gagal simpan (${res.status})`);
        return;
      }

      window.location.href = `/invoice/${json.id}`;
    } catch (e: any) {
      setMsg(e?.message || "Gagal simpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Invoice Baru</h1>
          <p style={{ marginTop: 6, color: "#666" }}>
            Pilih item dari master barang. Gudang opsional.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <a href="/invoice" style={btn()}>
            Kembali
          </a>
          <button onClick={save} disabled={saving || prefilling} style={btnPrimary()}>
            {saving ? "Menyimpan..." : "Simpan Invoice"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={card()}>
          <h3 style={{ margin: 0 }}>Info Invoice</h3>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={label()}>
              Tanggal
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                style={input()}
              />
            </label>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={label()}>
                Due Date
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={input()}
                />
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
            </div>

            <label style={label()}>
              Pilih Customer (optional)
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={input()}>
                <option value="">- manual -</option>
                {customers.map((c) => (
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
              Alamat Customer
              <textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                style={{ ...input(), minHeight: 80, resize: "vertical" }}
              />
            </label>

            <label style={label()}>
              Gudang (optional)
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} style={input()}>
                <option value="">- tanpa gudang / invoice only -</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              {loadingWh ? (
                <small style={{ color: "#666" }}>Loading gudang...</small>
              ) : warehouseId ? (
                <small style={{ color: "#666" }}>
                  Autocomplete item dibatasi ke barang yang ada di gudang ini.
                </small>
              ) : (
                <small style={{ color: "#666" }}>
                  Kalau kosong, semua barang aktif bisa dipilih dan invoice tidak dipakai untuk movement stok.
                </small>
              )}
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

        <div style={{ marginTop: 10, overflowX: "auto", overflowY: "visible", position: "relative" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th()}>Barang</th>
                <th style={th()}>Key</th>
                <th style={th()}>Qty</th>
                <th style={th()}>Harga</th>
                <th style={th()}>Total</th>
                <th style={th()}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const sug = it.openSug ? getSuggestionsFor(it.name) : [];
                const total = num(it.qty) * num(it.price);

                return (
                  <tr key={i}>
                    <td style={{ ...td(), position: "relative", minWidth: 360 }}>
                      <input
                        value={it.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          setItem(i, {
                            name: v,
                            product_id: "",
                            item_key: "",
                            openSug: true,
                          });
                        }}
                        onFocus={() => setItem(i, { openSug: true })}
                        onBlur={() => {
                          setTimeout(() => {
                            setItem(i, { openSug: false });
                          }, 140);
                        }}
                        placeholder={
                          warehouseId
                            ? "Pilih barang yang ada di gudang ini"
                            : "Pilih barang dari autocomplete"
                        }
                        style={input()}
                      />

                      {it.product_id ? (
                        <div style={{ fontSize: 12, color: "#166534", marginTop: 6 }}>
                          Barang sudah linked ke master product
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#b45309", marginTop: 6 }}>
                          Wajib pilih dari daftar barang
                        </div>
                      )}

                      {it.openSug && sug.length > 0 ? (
                        <div style={sugBox()}>
                          {sug.map((p) => {
                            const itemKey = productToItemKey(p);
                            const onHand = warehouseId ? getStockHint(itemKey) : undefined;
                            const priceN = Math.max(0, Math.floor(Number(p.price || 0)));

                            return (
                              <button
                                key={p.id}
                                type="button"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => pickSuggestion(i, p)}
                                style={sugBtn()}
                              >
                                <div style={{ fontWeight: 900 }}>
                                  {p.name}
                                  <span style={{ color: "#6b7280", fontWeight: 700 }}>
                                    {p.sku ? ` • ${p.sku}` : ""}
                                    {p.unit ? ` (${p.unit})` : ""}
                                  </span>
                                </div>

                                <div style={{ fontSize: 12, color: "#6b7280" }}>
                                  key: <span style={{ fontFamily: "monospace" }}>{itemKey}</span>
                                  {priceN ? ` • harga: Rp ${priceN.toLocaleString("id-ID")}` : ""}
                                  {warehouseId && typeof onHand === "number"
                                    ? ` • stok gudang ini: ${onHand}`
                                    : ""}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}

                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                        {loadingProd
                          ? "Loading barang..."
                          : warehouseId
                          ? loadingBalances
                            ? "Loading stok gudang..."
                            : `Barang tersedia di gudang ini: ${availableProducts.length}`
                          : `Semua barang aktif: ${products.length}`}
                      </div>
                    </td>

                    <td style={td()}>
                      <div style={{ fontFamily: "monospace", fontWeight: 800 }}>
                        {it.item_key || "-"}
                      </div>
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
                          placeholder="Harga"
                          style={input()}
                        />
                        <small style={{ color: "#666" }}>
                          {it.price > 0 ? `Rp ${it.price.toLocaleString("id-ID")}` : " "}
                        </small>
                      </div>
                    </td>

                    <td style={td()}>{rupiah(total)}</td>

                    <td style={td()}>
                      <button onClick={() => removeItem(i)} disabled={items.length === 1} style={miniBtnDanger()}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p style={{ marginTop: 10, color: "#666" }}>
            {warehouseId
              ? "Karena gudang dipilih, item dibatasi hanya ke barang yang ada di gudang tersebut."
              : "Kalau gudang tidak dipilih, semua barang aktif tetap bisa dipakai untuk invoice only."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function InvoiceNewPage() {
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
    whiteSpace: "nowrap",
  };
}

function td(): React.CSSProperties {
  return {
    borderBottom: "1px solid #f2f2f2",
    padding: "8px 6px",
    verticalAlign: "top",
  };
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

function sugBox(): React.CSSProperties {
  return {
    position: "absolute",
    left: 0,
    right: 0,
    top: 44,
    zIndex: 50,
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 12,
    boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
    overflow: "hidden",
    maxHeight: 260,
    overflowY: "auto",
  };
}

function sugBtn(): React.CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "white",
    padding: "10px 12px",
    cursor: "pointer",
    borderBottom: "1px solid #f1f5f9",
  };
}