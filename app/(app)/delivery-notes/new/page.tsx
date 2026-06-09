"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formPageClasses } from "../../components/form-page-classes";
import {
  formPageBackLink,
  formPageHeaderActions,
  tableActionSecondary,
} from "../../components/app-action-buttons";
import FormSubmitButton from "../../components/form-submit-button";
import { useSubmitGuard } from "../../components/use-submit-guard";
import { APP_TEAL } from "../../components/app-ui-tokens";
import { ProductItemAutocompleteInput } from "../../components/product-item-autocomplete-input";

type Customer = { id: string; name: string; phone: string; address: string };
type Warehouse = { id: string; name: string | null };
type Product = { id: string; name: string; unit: string | null; sku: string | null };

type ItemRow = {
  product_id: string;
  name: string;
  qty: number;
  qtyText: string;
  unit: string;
  openSug: boolean;
};

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function digitsOnlyString(raw: string) {
  return String(raw ?? "").replace(/\D/g, "");
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 14,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#64748b",
  marginBottom: 6,
};

export default function DeliveryNoteManualNewPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { tryBegin, end, isBlocked } = useSubmitGuard(setSaving);
  const [msg, setMsg] = useState("");

  const [sjDate, setSjDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [driverName, setDriverName] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [note, setNote] = useState("");

  const [items, setItems] = useState<ItemRow[]>([
    { product_id: "", name: "", qty: 1, qtyText: "1", unit: "", openSug: false },
  ]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [custRes, whRes, prodRes] = await Promise.all([
        supabase.from("customers").select("id,name,phone,address").order("name", { ascending: true }),
        supabase.from("warehouses").select("id,name").eq("is_active", true).order("name", { ascending: true }),
        supabase
          .from("products")
          .select("id,name,unit,sku")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);
      setCustomers((custRes.data || []) as Customer[]);
      setWarehouses((whRes.data || []) as Warehouse[]);
      setProducts((prodRes.data || []) as Product[]);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!customerId) return;
    const c = customers.find((x) => x.id === customerId);
    if (!c) return;
    setCustomerName(c.name || "");
    setCustomerPhone(c.phone || "");
    setShippingAddress(c.address || "");
  }, [customerId, customers]);

  function setItem(i: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function addItem() {
    setItems((prev) => [...prev, { product_id: "", name: "", qty: 1, qtyText: "1", unit: "", openSug: false }]);
  }

  function removeItem(i: number) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function getSuggestionsFor(raw: string) {
    const s = String(raw || "").trim().toLowerCase();
    const list = products || [];
    if (!s) return list.slice(0, 10);
    return list
      .filter((p) => `${p.name} ${p.sku || ""} ${p.unit || ""}`.toLowerCase().includes(s))
      .slice(0, 10);
  }

  function pickSuggestion(rowIdx: number, p: Product) {
    setItem(rowIdx, {
      product_id: p.id,
      name: p.name,
      unit: p.unit || "",
      openSug: false,
    });
  }

  function onChangeQty(rowIdx: number, raw: string) {
    const digits = digitsOnlyString(raw);
    const qtyNum = digits === "" ? 0 : Math.max(0, Number(digits));
    setItem(rowIdx, { qtyText: digits, qty: qtyNum });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isBlocked()) return;
    setMsg("");
    if (!tryBegin()) return;

    try {
      const payload = {
        sj_date: sjDate,
        customer_id: customerId || null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        shipping_address: shippingAddress.trim(),
        driver_name: driverName.trim(),
        warehouse_id: warehouseId || null,
        note: note.trim(),
        items: items.map((it) => ({
          name: it.name.trim(),
          qty: num(it.qty),
          unit: it.unit.trim() || null,
          product_id: it.product_id || null,
        })),
      };

      const res = await fetch("/api/delivery-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({} as { error?: string; id?: string }));
      if (!res.ok) {
        setMsg(json?.error || `Gagal menyimpan (${res.status})`);
        return;
      }

      router.push(`/delivery-notes/${json.id}`);
      router.refresh();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      end();
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Memuat data...</div>;
  }

  return (
    <div className={formPageClasses.page} style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
      <div
        className={formPageClasses.header}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 26 }}>Buat Surat Jalan Manual</h1>
          <p style={{ marginTop: 8, color: "#64748b", maxWidth: 560 }}>
            Untuk pengiriman tanpa invoice (sampel, pengganti, kirim dulu invoice belakangan, dll). Nomor SJ
            dibuat otomatis setelah disimpan.
          </p>
        </div>
        <div className={formPageClasses.headerActions} style={formPageHeaderActions()}>
          <Link
            href="/delivery-notes"
            style={{
              ...formPageBackLink(),
              pointerEvents: saving ? "none" : undefined,
              opacity: saving ? 0.55 : 1,
            }}
          >
            Kembali
          </Link>
          <FormSubmitButton
            type="submit"
            form="manual-delivery-note-form"
            busy={saving}
            busyLabel="Menyimpan..."
          >
            Simpan Surat Jalan
          </FormSubmitButton>
        </div>
      </div>

      <form id="manual-delivery-note-form" onSubmit={handleSubmit} style={{ marginTop: 20 }}>
        <div className={formPageClasses.grid2} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card()}>
            <h3 style={sectionTitle()}>Customer</h3>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Pilih customer (opsional)</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Manual / ketik nama —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Nama customer *</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={inputStyle}
                required
                disabled={!!customerId}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Telepon</label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={inputStyle}
                disabled={!!customerId}
              />
            </div>
          </div>

          <div style={card()}>
            <h3 style={sectionTitle()}>Pengiriman</h3>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Tanggal surat jalan *</label>
              <input
                type="date"
                value={sjDate}
                onChange={(e) => setSjDate(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Alamat pengiriman *</label>
              <textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                style={{ ...inputStyle, minHeight: 88, resize: "vertical" }}
                required
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Driver / kurir</label>
              <input value={driverName} onChange={(e) => setDriverName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Gudang</label>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} style={inputStyle}>
                <option value="">— Pilih gudang —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name || w.id}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Catatan</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, ...card() }}>
          <div className={formPageClasses.sectionHead} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ ...sectionTitle(), margin: 0 }}>Item barang</h3>
            <button type="button" onClick={addItem} style={tableActionSecondary()}>
              + Tambah baris
            </button>
          </div>

          <div className={formPageClasses.tableScroll} style={{ marginTop: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={th()}>Barang *</th>
                  <th style={th()}>Qty *</th>
                  <th style={th()}>Satuan</th>
                  <th style={th()} />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const sug = it.openSug ? getSuggestionsFor(it.name) : [];
                  return (
                    <tr key={i}>
                      <td style={{ ...td(), minWidth: 280 }}>
                        <ProductItemAutocompleteInput
                          value={it.name}
                          productId={it.product_id}
                          open={it.openSug}
                          suggestions={sug}
                          onOpenChange={(next) => {
                            if (next) {
                              setItems((prev) =>
                                prev.map((row, idx) => ({ ...row, openSug: idx === i }))
                              );
                            } else {
                              setItem(i, { openSug: false });
                            }
                          }}
                          onChange={(v) => {
                            setItems((prev) =>
                              prev.map((row, idx) =>
                                idx === i
                                  ? { ...row, name: v, product_id: "", openSug: true }
                                  : { ...row, openSug: false }
                              )
                            );
                          }}
                          onSelect={(p) => pickSuggestion(i, p)}
                          placeholder="Cari produk atau ketik nama barang"
                          required
                          inputStyle={inputStyle}
                        />
                      </td>
                      <td style={td()}>
                        <input
                          value={it.qtyText}
                          onChange={(e) => onChangeQty(i, e.target.value)}
                          style={{ ...inputStyle, maxWidth: 100 }}
                          inputMode="numeric"
                          required
                        />
                      </td>
                      <td style={td()}>
                        <input
                          value={it.unit}
                          onChange={(e) => setItem(i, { unit: e.target.value })}
                          style={{ ...inputStyle, maxWidth: 120 }}
                          placeholder="pcs"
                        />
                      </td>
                      <td style={td()}>
                        <button type="button" onClick={() => removeItem(i)} style={tableActionSecondary()}>
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {msg ? (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "#fef2f2", color: "#991b1b", fontWeight: 600 }}>
            {msg}
          </div>
        ) : null}
      </form>
    </div>
  );
}

function card(): React.CSSProperties {
  return {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };
}

function sectionTitle(): React.CSSProperties {
  return { margin: 0, fontSize: 16, color: APP_TEAL, fontWeight: 800 };
}

function th(): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "10px 8px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
  };
}

function td(): React.CSSProperties {
  return { padding: "8px 6px", verticalAlign: "middle" };
}
