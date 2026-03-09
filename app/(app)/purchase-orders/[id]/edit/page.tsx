// ✅ FULL REPLACE (EDIT PAGE + vendor & gudang dropdown + auto-fill ship to)
// invoiceku/app/(app)/purchase-orders/[id]/edit/page.tsx
//
// Assumsi kolom di purchase_orders sudah ada:
// - vendor_id (uuid)
// - warehouse_id (uuid, nullable)
// - ship_to_name (text, nullable)   // snapshot gudang (nama)
// - ship_to_phone (text, nullable)  // snapshot gudang (telp)
// - ship_to_address (text, nullable)// snapshot gudang (alamat)
//
// Kalau nama kolom ship-to kamu beda, tinggal ganti di 2 tempat:
// 1) select() load PO
// 2) update() saat save()

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Vendor = {
  id: string;
  vendor_code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean | null;
};

type Warehouse = {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  address: string;
  is_active: boolean;
};

type PO = {
  id: string;
  po_number: string | null;
  po_date: string | null;

  vendor_id: string | null;
  vendor_name: string | null;
  vendor_phone: string | null;
  vendor_address: string | null;

  warehouse_id: string | null;
  ship_to_name: string | null;
  ship_to_phone: string | null;
  ship_to_address: string | null;

  note: string | null;
  status: string | null;
};

type Item = {
  id?: string;
  name: string;
  qty: number;
  price: number;
  qtyText: string;
  priceText: string;
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

export default function PurchaseOrderEditPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [po, setPo] = useState<PO | null>(null);

  // dropdown sources
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // chosen ids (master)
  const [vendorId, setVendorId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");

  // snapshots in PO (tetap disimpan)
  const [poDate, setPoDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [vendorName, setVendorName] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");

  const [shipToName, setShipToName] = useState("");
  const [shipToPhone, setShipToPhone] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");

  const [note, setNote] = useState("");

  const [items, setItems] = useState<Item[]>([
    { name: "", qty: 1, price: 0, qtyText: "1", priceText: "" },
  ]);

  const isCancelled = String(po?.status || "").toLowerCase() === "cancelled";

  function setItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function addItem() {
    setItems((prev) => [...prev, { name: "", qty: 1, price: 0, qtyText: "1", priceText: "" }]);
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

  const subtotal = useMemo(
    () => items.reduce((a, it) => a + Math.floor(num(it.qty)) * Math.floor(num(it.price)), 0),
    [items]
  );

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

      // org_id
      const { data: membership, error: memErr } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", userRes.user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (memErr) throw memErr;

      const orgId = String((membership as any)?.org_id || "");
      if (!orgId) {
        setMsg("Org tidak ditemukan. Pastikan membership aktif.");
        setPo(null);
        return;
      }

      // load master vendors & warehouses
      const [vRes, wRes] = await Promise.all([
        supabase
          .from("vendors")
          .select("id,vendor_code,name,phone,email,address,is_active")
          .eq("org_id", orgId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("warehouses")
          .select("id,code,name,phone,address,is_active")
          .eq("org_id", orgId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      if (vRes.error) throw vRes.error;
      if (wRes.error) throw wRes.error;

      setVendors((vRes.data as any) || []);
      setWarehouses((wRes.data as any) || []);

      // load PO (include vendor_id + warehouse snapshot)
      const { data: poRow, error: poErr } = await supabase
        .from("purchase_orders")
        .select(
          "id,po_number,po_date,status,note," +
            "vendor_id,vendor_name,vendor_phone,vendor_address," +
            "warehouse_id,ship_to_name,ship_to_phone,ship_to_address"
        )
        .eq("id", id)
        .maybeSingle();

      if (poErr) throw poErr;
      if (!poRow) {
        setMsg("PO tidak ditemukan.");
        setPo(null);
        return;
      }

      const { data: itRows, error: itErr } = await supabase
        .from("purchase_order_items")
        .select("id,name,qty,price,sort_order")
        .eq("purchase_order_id", id)
        .order("sort_order", { ascending: true });

      if (itErr) throw itErr;

      setPo(poRow as any);

      // set form state
      setPoDate(String((poRow as any).po_date || "").slice(0, 10) || new Date().toISOString().slice(0, 10));

      setVendorId(String((poRow as any).vendor_id || ""));
      setVendorName(String((poRow as any).vendor_name || ""));
      setVendorPhone(String((poRow as any).vendor_phone || ""));
      setVendorAddress(String((poRow as any).vendor_address || ""));

      setWarehouseId(String((poRow as any).warehouse_id || ""));
      setShipToName(String((poRow as any).ship_to_name || ""));
      setShipToPhone(String((poRow as any).ship_to_phone || ""));
      setShipToAddress(String((poRow as any).ship_to_address || ""));

      setNote(String((poRow as any).note || ""));

      const mapped =
        (itRows as any[] | null)?.map((x) => {
          const q = Math.max(0, Math.floor(num(x.qty)));
          const p = Math.max(0, Math.floor(num(x.price)));
          return {
            id: x.id,
            name: String(x.name || ""),
            qty: q,
            qtyText: q ? String(q) : "",
            price: p,
            priceText: p ? formatThousandsID(p) : "",
          } as Item;
        }) || [];

      setItems(mapped.length ? mapped : [{ name: "", qty: 1, price: 0, qtyText: "1", priceText: "" }]);
    } catch (e: any) {
      setMsg(e?.message || "Gagal load PO.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ✅ ketika pilih vendor => auto snapshot vendor (nama/telp/alamat)
  useEffect(() => {
    if (!vendorId) return;
    const v = vendors.find((x) => x.id === vendorId);
    if (!v) return;
    setVendorName(v.name || "");
    setVendorPhone(v.phone || "");
    setVendorAddress(v.address || "");
  }, [vendorId, vendors]);

  // ✅ ketika pilih gudang => auto snapshot ship to (name/phone/address)
  useEffect(() => {
    if (!warehouseId) return;
    const w = warehouses.find((x) => x.id === warehouseId);
    if (!w) return;
    setShipToName(w.name || "");
    setShipToPhone(w.phone || "");
    setShipToAddress(w.address || "");
  }, [warehouseId, warehouses]);

  async function save() {
    setMsg("");

    if (isCancelled) return setMsg("PO cancelled (readonly).");
    if (!vendorId) return setMsg("Pilih vendor dulu ya.");
    if (!vendorName.trim()) return setMsg("Vendor name wajib diisi.");
    if (items.length === 0) return setMsg("Minimal 1 item.");
    if (items.some((it) => !it.name.trim())) return setMsg("Nama item tidak boleh kosong.");

    setSaving(true);
    try {
      // update header + snapshot + subtotal/total
      const { error: upErr } = await supabase
        .from("purchase_orders")
        .update({
          po_date: poDate,

          vendor_id: vendorId,
          vendor_name: vendorName,
          vendor_phone: vendorPhone || null,
          vendor_address: vendorAddress || null,

          // gudang boleh kosong
          warehouse_id: warehouseId || null,
          ship_to_name: shipToName || null,
          ship_to_phone: shipToPhone || null,
          ship_to_address: shipToAddress || null,

          note: note || null,

          subtotal,
          total: subtotal,
        })
        .eq("id", id);

      if (upErr) throw upErr;

      // replace items (simple & aman dulu)
      const { error: delErr } = await supabase.from("purchase_order_items").delete().eq("purchase_order_id", id);
      if (delErr) throw delErr;

      const payloadItems = items.map((it, idx) => ({
        purchase_order_id: id,
        name: String(it.name || ""),
        qty: Math.max(0, Math.floor(num(it.qty))),
        price: Math.max(0, Math.floor(num(it.price))),
        sort_order: idx,
      }));

      const { error: insErr } = await supabase.from("purchase_order_items").insert(payloadItems);
      if (insErr) throw insErr;

      router.push(`/purchase-orders/${id}`);
      router.refresh();
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
          <h1 style={{ margin: 0 }}>Edit PO {po?.po_number ? `— ${po.po_number}` : ""}</h1>
          <p style={{ marginTop: 6, color: "#666" }}>
            {loading ? "Loading..." : isCancelled ? "Status: CANCELLED (readonly)" : "Edit PO lalu simpan."}
          </p>
          {msg ? <p style={{ marginTop: 6, color: "#b00", fontWeight: 700 }}>{msg}</p> : null}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push(`/purchase-orders/${id}`)} style={btn()}>
            Kembali
          </button>
          <button onClick={save} disabled={saving || loading || isCancelled} style={btnPrimary()}>
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={card()}>
          <h3 style={{ margin: 0 }}>Info PO</h3>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={label()}>
              Tanggal PO
              <input
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
                style={input()}
                disabled={isCancelled}
              />
            </label>

            <label style={label()}>
              Pilih Vendor (wajib)
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                style={input()}
                disabled={isCancelled || loading}
              >
                <option value="">- pilih vendor -</option>
                {(vendors || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendor_code ? `${v.vendor_code} • ` : ""}
                    {v.name}
                  </option>
                ))}
              </select>
              {loading ? <small style={{ color: "#666" }}>Loading vendor...</small> : null}
            </label>

            <label style={label()}>
              Nama Vendor (snapshot)
              <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} style={input()} disabled={isCancelled} />
            </label>

            <label style={label()}>
              Vendor Phone (snapshot)
              <input value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} style={input()} disabled={isCancelled} />
            </label>

            <label style={label()}>
              Vendor Address (snapshot)
              <textarea
                value={vendorAddress}
                onChange={(e) => setVendorAddress(e.target.value)}
                style={{ ...input(), minHeight: 80 }}
                disabled={isCancelled}
              />
            </label>

            <label style={label()}>
              Pilih Gudang / Ship To (optional)
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                style={input()}
                disabled={isCancelled || loading}
              >
                <option value="">- tidak pakai gudang -</option>
                {(warehouses || []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code ? `${w.code} • ` : ""}
                    {w.name}
                  </option>
                ))}
              </select>
              {loading ? <small style={{ color: "#666" }}>Loading gudang...</small> : null}
            </label>

            <div style={{ display: "grid", gap: 10, marginTop: 2 }}>
              <label style={label()}>
                Ship To Name (snapshot)
                <input
                  value={shipToName}
                  onChange={(e) => setShipToName(e.target.value)}
                  style={input()}
                  disabled={isCancelled || !warehouseId}
                />
              </label>

              <label style={label()}>
                Ship To Phone (snapshot)
                <input
                  value={shipToPhone}
                  onChange={(e) => setShipToPhone(e.target.value)}
                  style={input()}
                  disabled={isCancelled || !warehouseId}
                />
              </label>

              <label style={label()}>
                Ship To Address (snapshot)
                <textarea
                  value={shipToAddress}
                  onChange={(e) => setShipToAddress(e.target.value)}
                  style={{ ...input(), minHeight: 80 }}
                  disabled={isCancelled || !warehouseId}
                />
              </label>

              {!warehouseId ? (
                <small style={{ color: "#666" }}>
                  Pilih gudang dulu supaya Ship To terisi otomatis.
                </small>
              ) : null}
            </div>

            <label style={label()}>
              Note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ ...input(), minHeight: 80 }}
                disabled={isCancelled}
              />
            </label>
          </div>
        </div>

        <div style={card()}>
          <h3 style={{ margin: 0 }}>Ringkasan</h3>
          <div style={{ marginTop: 10 }}>
            <Row k="Subtotal" v={<b>Rp {subtotal.toLocaleString("id-ID")}</b>} />
            <small style={{ color: "#666" }}>Edit PO: subtotal & total ikut diupdate ke DB.</small>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, ...card() }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Items</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addItem} style={btn()} disabled={isCancelled}>
              + Tambah Item
            </button>
          </div>
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
                      disabled={isCancelled}
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
                      disabled={isCancelled}
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
                      disabled={isCancelled}
                    />
                  </td>

                  <td style={td()}>
                    Rp {(Math.floor(num(it.qty)) * Math.floor(num(it.price))).toLocaleString("id-ID")}
                  </td>

                  <td style={td()}>
                    <button onClick={() => removeItem(i)} disabled={items.length === 1 || isCancelled} style={miniBtnDanger()}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: 10, color: "#666" }}>
            Vendor & gudang dipilih dari master. Snapshot tetap disimpan di PO biar histori aman.
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
