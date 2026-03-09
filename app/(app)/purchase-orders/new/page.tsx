"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Vendor = {
  id: string;
  vendor_code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  is_active: boolean | null;
};

type Warehouse = {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean | null;
};

type Product = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  price: number | null;
  is_active: boolean | null;
};

type BalanceRow = {
  item_key: string;
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

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

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

function rupiah(n: any) {
  const v = Math.max(0, Math.floor(num(n)));
  return `Rp ${v.toLocaleString("id-ID")}`;
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

export default function PONewPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [orgId, setOrgId] = useState<string>("");

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState<string>("");

  const [vendorName, setVendorName] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");

  const [shipToName, setShipToName] = useState("");
  const [shipToPhone, setShipToPhone] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");

  const [poDate, setPoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const [balancesMap, setBalancesMap] = useState<Record<string, number>>({});
  const [stockLoading, setStockLoading] = useState(false);

  const [items, setItems] = useState<Item[]>([
    {
      product_id: "",
      name: "",
      item_key: "",
      qty: 1,
      price: 0,
      qtyText: "1",
      priceText: "",
      openSug: false,
    },
  ]);

  const calc = useMemo(() => {
    const sub = items.reduce((a, it) => a + num(it.qty) * num(it.price), 0);
    return { sub, total: sub };
  }, [items]);

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
        price: 0,
        qtyText: "1",
        priceText: "",
        openSug: false,
      },
    ]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onChangeQty(i: number, raw: string) {
    const digits = digitsOnlyString(raw);
    const qtyNum = digits === "" ? 0 : Math.max(0, Math.floor(Number(digits)));
    setItem(i, { qtyText: digits, qty: qtyNum });
  }

  function onBlurQty(i: number) {
    const it = items[i];
    const q = Math.max(0, Math.floor(num(it.qty)));
    const nextText = it.qtyText === "" ? "" : String(q);
    setItem(i, { qty: q, qtyText: nextText });
  }

  function onChangePrice(i: number, raw: string) {
    const n = digitsToNumber(raw);
    setItem(i, { price: n, priceText: formatThousandsID(n) });
  }

  function onBlurPrice(i: number) {
    const it = items[i];
    const n = Math.max(0, Math.floor(num(it.price)));
    setItem(i, { price: n, priceText: formatThousandsID(n) });
  }

  async function loadProductMaster(oid: string) {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,sku,unit,price,is_active")
        .eq("org_id", oid)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      setProducts((data || []) as any);
    } catch (e) {
      console.error("loadProductMaster error:", e);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }

  async function loadBalancesForWarehouse(oid: string, whId: string) {
    if (!oid || !whId) {
      setBalancesMap({});
      return;
    }

    setStockLoading(true);
    try {
      const { data, error } = await supabase
        .from("inventory_balances")
        .select("item_key,on_hand")
        .eq("org_id", oid)
        .eq("warehouse_id", whId)
        .limit(3000);

      if (error) throw error;

      const map: Record<string, number> = {};
      ((data || []) as BalanceRow[]).forEach((r) => {
        const key = String(r.item_key || "").trim().toLowerCase();
        if (!key) return;
        map[key] = Math.floor(num(r.on_hand));
      });

      setBalancesMap(map);
    } catch (e) {
      console.error("loadBalancesForWarehouse error:", e);
      setBalancesMap({});
    } finally {
      setStockLoading(false);
    }
  }

  async function loadInitial() {
    setLoading(true);
    setMsg("");

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        setMsg("Unauthorized");
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

      const oid = String((membership as any)?.org_id || "");
      if (!oid) {
        setMsg("Org tidak ditemukan. Pastikan membership aktif.");
        return;
      }
      setOrgId(oid);

      const { data: vData, error: vErr } = await supabase
        .from("vendors")
        .select("id,vendor_code,name,phone,email,address,note,is_active")
        .eq("org_id", oid)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(500);
      if (vErr) throw vErr;
      setVendors((vData as any) || []);

      const { data: wData, error: wErr } = await supabase
        .from("warehouses")
        .select("id,name,phone,address,is_active,created_at")
        .eq("org_id", oid)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(500);
      if (wErr) throw wErr;

      const wList = ((wData as any) || []) as Warehouse[];
      setWarehouses(wList);

      let pickedWh = warehouseId;
      if (!pickedWh && wList.length > 0) {
        const w0 = wList[0];
        pickedWh = w0.id;
        setWarehouseId(w0.id);
        setShipToName(String(w0.name || ""));
        setShipToPhone(String(w0.phone || ""));
        setShipToAddress(String(w0.address || ""));
      }

      await Promise.all([
        loadProductMaster(oid),
        loadBalancesForWarehouse(oid, pickedWh || ""),
      ]);
    } catch (e: any) {
      setMsg(e?.message || "Gagal load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (!vendorId) return;
    const v = vendors.find((x) => x.id === vendorId);
    if (!v) return;
    setVendorName(v.name || "");
    setVendorPhone(v.phone || "");
    setVendorEmail(v.email || "");
    setVendorAddress(v.address || "");
  }, [vendorId, vendors]);

  useEffect(() => {
    if (!warehouseId) {
      setShipToName("");
      setShipToPhone("");
      setShipToAddress("");
      setBalancesMap({});
      return;
    }

    const w = warehouses.find((x) => x.id === warehouseId);
    if (!w) return;

    setShipToName(String(w.name || ""));
    setShipToPhone(String(w.phone || ""));
    setShipToAddress(String(w.address || ""));

    if (orgId) loadBalancesForWarehouse(orgId, warehouseId);
  }, [warehouseId, warehouses, orgId]);

  function getSuggestionsFor(raw: string) {
    const s = String(raw || "").trim().toLowerCase();
    const list = products || [];
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
              name: p.name,
              item_key: itemKey,
              price: priceN,
              priceText: priceN ? formatThousandsID(priceN) : "",
              openSug: false,
            }
          : it
      )
    );
  }

  async function save() {
    setMsg("");

    if (!vendorId) return setMsg("Pilih vendor dulu ya.");
    if (!vendorName.trim()) return setMsg("Nama vendor wajib.");
    if (items.length === 0) return setMsg("Minimal 1 item.");
    if (items.some((it) => !String(it.name || "").trim())) return setMsg("Nama item tidak boleh kosong.");
    if (items.some((it) => !String(it.product_id || "").trim())) {
      return setMsg("Semua item PO harus pilih dari master barang.");
    }
    if (!warehouseId) return setMsg("Pilih gudang (Ship To) dulu ya.");

    const missingKeyIdx = items.findIndex((it) => !String(it.item_key || "").trim());
    if (missingKeyIdx >= 0) return setMsg("Ada item yang belum punya key.");

    setSaving(true);
    try {
      const payload = {
        po_date: poDate,
        vendor_id: vendorId,
        vendor_name: vendorName,
        vendor_phone: vendorPhone || null,
        vendor_email: vendorEmail || null,
        vendor_address: vendorAddress || null,

        warehouse_id: warehouseId,
        ship_to_name: shipToName || null,
        ship_to_phone: shipToPhone || null,
        ship_to_address: shipToAddress || null,

        note: note || "",
        items: items.map((it) => ({
          product_id: String(it.product_id || "").trim(),
          name: String(it.name || "").trim(),
          item_key: String(it.item_key || "").trim(),
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
      if (!res.ok) return setMsg(json?.error || `Gagal simpan (${res.status})`);

      router.push(`/purchase-orders/${json.id}`);
    } catch (e: any) {
      setMsg(e?.message || "Gagal simpan PO.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>PO Baru</h1>
          <p style={{ marginTop: 6, color: "#666" }}>
            Pilih vendor, pilih gudang tujuan, lalu pilih item dari master barang. Stok gudang hanya ditampilkan sebagai hint.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/purchase-orders" style={btn()}>
            Kembali
          </Link>
          <button onClick={save} disabled={saving || loading} style={btnPrimary()}>
            {saving ? "Menyimpan..." : "Simpan PO"}
          </button>
        </div>
      </div>

      {msg ? <div style={errBox()}>{msg}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={card()}>
          <h3 style={{ margin: 0 }}>Info PO</h3>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={label()}>
              Tanggal PO
              <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Pilih Vendor (wajib)
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} style={input()}>
                <option value="">- pilih vendor -</option>
                {(vendors || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendor_code ? `${v.vendor_code} • ` : ""}
                    {v.name}
                  </option>
                ))}
              </select>
              {loading ? <small style={{ color: "#666" }}>Loading...</small> : null}
            </label>

            <label style={label()}>
              Nama Vendor (snapshot)
              <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Phone
              <input value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Email
              <input value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Alamat
              <textarea
                value={vendorAddress}
                onChange={(e) => setVendorAddress(e.target.value)}
                style={{ ...input(), minHeight: 90, resize: "vertical" }}
              />
            </label>

            <label style={label()}>
              Catatan
              <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input(), minHeight: 90 }} />
            </label>
          </div>
        </div>

        <div style={card()}>
          <h3 style={{ margin: 0 }}>Ship To (Gudang)</h3>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={label()}>
              Pilih Gudang (wajib)
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} style={input()}>
                {warehouses.length === 0 ? (
                  <option value="">(belum ada gudang)</option>
                ) : (
                  <>
                    <option value="">- pilih gudang -</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name || "(no name)"}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {warehouses.length === 0 ? (
                <small style={{ color: "#b45309" }}>Gudang belum ada. Buat dulu di menu Warehouse.</small>
              ) : (
                <small style={{ color: "#666" }}>
                  Gudang hanya untuk tujuan penerimaan dan melihat stok saat ini. Semua barang master tetap bisa dipilih di PO.
                </small>
              )}
            </label>

            <label style={label()}>
              Ship To - Nama Gudang (snapshot)
              <input value={shipToName} onChange={(e) => setShipToName(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Ship To - Telp Gudang (snapshot)
              <input value={shipToPhone} onChange={(e) => setShipToPhone(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Ship To - Alamat Gudang (snapshot)
              <textarea
                value={shipToAddress}
                onChange={(e) => setShipToAddress(e.target.value)}
                style={{ ...input(), minHeight: 90, resize: "vertical" }}
              />
            </label>

            <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 10 }}>
              <Row k="Subtotal" v={rupiah(calc.sub)} />
              <Row k="Total" v={<b>{rupiah(calc.total)}</b>} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, ...card() }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>Items</h3>
            <div style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
              {productsLoading
                ? "Loading products..."
                : warehouseId
                ? stockLoading
                  ? `Products loaded: ${products.length} • loading stok gudang...`
                  : `Products loaded: ${products.length} • stok gudang tampil sebagai hint`
                : `Products loaded: ${products.length}`}
            </div>
          </div>
          <button onClick={addItem} style={btn()}>
            + Tambah Item
          </button>
        </div>

        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th()}>Nama Barang</th>
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
                          }, 120);
                        }}
                        placeholder="Pilih item dari master barang"
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
                          <div style={{ maxHeight: 220, overflowY: "auto" }}>
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
                                    {priceN ? ` • harga default: Rp ${priceN.toLocaleString("id-ID")}` : ""}
                                    {warehouseId
                                      ? ` • stok gudang ini: ${typeof onHand === "number" ? onHand : 0}`
                                      : ""}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </td>

                    <td style={td()}>
                      <div
                        style={{
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          fontWeight: 800,
                        }}
                      >
                        {it.item_key || "-"}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>auto dari product</div>
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
                );
              })}
            </tbody>
          </table>

          <p style={{ marginTop: 10, color: "#666" }}>
            PO selalu mengambil item dari master <b>Barang</b>. Kalau gudang dipilih, stok gudang hanya ditampilkan sebagai hint.
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

function errBox(): React.CSSProperties {
  return {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontWeight: 900,
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