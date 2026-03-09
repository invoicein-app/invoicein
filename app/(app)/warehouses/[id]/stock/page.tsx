"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string;
  is_active: boolean;
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
  item_name: string;
  product_id?: string | null;
  on_hand: number;
  updated_at: string | null;
};

type LedgerRow = {
  id: string;
  ref_type: string | null;
  ref_id: string | null;
  ref_line_id: string | null;
  product_name: string | null;
  qty_in: number | null;
  qty_out: number | null;
  created_at: string;
};

function isUuid(v: any) {
  const s = String(v || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}
function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function fmtDT(s: any) {
  if (!s) return "-";
  const d = new Date(String(s));
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function isAdminRole(role: string) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "owner" || r === "super_admin";
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

export default function WarehouseStockPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useParams();

  const warehouseId = String((params as any)?.id || "").trim();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [wh, setWh] = useState<Warehouse | null>(null);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orgId, setOrgId] = useState<string>("");

  const [tab, setTab] = useState<"balances" | "ledger">("balances");

  const [q, setQ] = useState("");
  const [onlyHasStock, setOnlyHasStock] = useState(true);

  const [ledgerLimit, setLedgerLimit] = useState(100);
  const [ledgerQ, setLedgerQ] = useState("");

  const [role, setRole] = useState<string>("");
  const canAdjust = useMemo(() => isAdminRole(role), [role]);

  const [adjOpen, setAdjOpen] = useState(false);
  const [adjBusy, setAdjBusy] = useState(false);
  const [adjMsg, setAdjMsg] = useState("");

  const [adjProductId, setAdjProductId] = useState<string>("");
  const [adjDir, setAdjDir] = useState<"in" | "out">("in");
  const [adjQtyText, setAdjQtyText] = useState<string>("1");
  const [adjNote, setAdjNote] = useState<string>("");

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === adjProductId) || null;
  }, [products, adjProductId]);

  const adjItemKey = useMemo(() => {
    if (!selectedProduct) return "";
    return productToItemKey(selectedProduct);
  }, [selectedProduct]);

  const adjItemName = useMemo(() => {
    return selectedProduct?.name || "";
  }, [selectedProduct]);

  const adjCurrentOnHand = useMemo(() => {
    if (!adjItemKey) return 0;
    const found = balances.find((b) => String(b.item_key || "").trim().toLowerCase() === adjItemKey.toLowerCase());
    return found ? Math.floor(num(found.on_hand)) : 0;
  }, [adjItemKey, balances]);

  const totalOnHand = useMemo(() => {
    return (filteredBalances(balances, q, onlyHasStock) || []).reduce(
      (a, r) => a + Math.max(0, Math.floor(num(r.on_hand))),
      0
    );
  }, [balances, q, onlyHasStock]);

  function resetAdj() {
    setAdjMsg("");
    setAdjProductId("");
    setAdjDir("in");
    setAdjQtyText("1");
    setAdjNote("");
  }

  function parseQty(raw: string) {
    const s = String(raw || "").replace(/\D/g, "");
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  async function loadRole() {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const { data: mem } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", userRes.user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      setRole(String((mem as any)?.role || ""));
    } catch {}
  }

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      if (!isUuid(warehouseId)) {
        setWh(null);
        setBalances([]);
        setLedger([]);
        setProducts([]);
        setErr("Invalid warehouse id.");
        return;
      }

      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        setErr("Unauthorized");
        return;
      }

      const { data: mem, error: memErr } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", userRes.user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (memErr) throw memErr;

      const currentOrgId = String((mem as any)?.org_id || "");
      if (!currentOrgId) {
        setErr("Org tidak ditemukan. Pastikan membership aktif.");
        return;
      }
      setOrgId(currentOrgId);

      const { data: whRow, error: whErr } = await supabase
        .from("warehouses")
        .select("id,code,name,phone,address,is_active")
        .eq("id", warehouseId)
        .eq("org_id", currentOrgId)
        .maybeSingle();

      if (whErr) throw whErr;
      if (!whRow) {
        setErr("Gudang tidak ditemukan / beda org.");
        setWh(null);
        return;
      }
      setWh(whRow as any);

      const { data: balRows, error: balErr } = await supabase
        .from("inventory_balances")
        .select("item_key,item_name,product_id,on_hand,updated_at")
        .eq("org_id", currentOrgId)
        .eq("warehouse_id", warehouseId)
        .order("item_name", { ascending: true })
        .limit(2000);

      if (balErr) throw balErr;
      setBalances(((balRows as any) || []) as BalanceRow[]);

      const { data: ledRows, error: ledErr } = await supabase
        .from("stock_ledger")
        .select("id,ref_type,ref_id,ref_line_id,product_name,qty_in,qty_out,created_at")
        .eq("org_id", currentOrgId)
        .eq("warehouse_id", warehouseId)
        .order("created_at", { ascending: false })
        .limit(ledgerLimit);

      if (ledErr) throw ledErr;
      setLedger(((ledRows as any) || []) as LedgerRow[]);

      const { data: prodRows, error: prodErr } = await supabase
        .from("products")
        .select("id,name,sku,unit,price,is_active")
        .eq("org_id", currentOrgId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (prodErr) throw prodErr;
      setProducts(((prodRows as any) || []) as Product[]);
    } catch (e: any) {
      setErr(e?.message || "Gagal load stock gudang.");
    } finally {
      setLoading(false);
    }
  }

  async function reloadLedgerOnly(nextLimit?: number) {
    setErr("");
    try {
      if (!isUuid(warehouseId) || !orgId) return;

      const lim = Math.max(20, Number(nextLimit ?? ledgerLimit));

      const { data: ledRows, error: ledErr } = await supabase
        .from("stock_ledger")
        .select("id,ref_type,ref_id,ref_line_id,product_name,qty_in,qty_out,created_at")
        .eq("org_id", orgId)
        .eq("warehouse_id", warehouseId)
        .order("created_at", { ascending: false })
        .limit(lim);

      if (ledErr) throw ledErr;

      setLedger(((ledRows as any) || []) as LedgerRow[]);
    } catch (e: any) {
      setErr(e?.message || "Gagal load ledger.");
    }
  }

  useEffect(() => {
    loadRole();
  }, []);

  useEffect(() => {
    loadAll();
  }, [warehouseId, ledgerLimit]);

  async function submitAdjustment() {
    setAdjMsg("");

    if (!canAdjust) {
      return setAdjMsg("Hanya admin/owner yang boleh melakukan stock adjustment.");
    }

    if (!isUuid(adjProductId)) {
      return setAdjMsg("Pilih barang dari master barang dulu.");
    }

    const qty = parseQty(adjQtyText);
    if (qty <= 0) return setAdjMsg("Qty harus > 0.");

    const delta = adjDir === "in" ? qty : -qty;

    setAdjBusy(true);
    try {
      const res = await fetch(`/api/warehouses/${warehouseId}/stock-adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          product_id: adjProductId,
          qty_delta: delta,
          note: String(adjNote || "").trim() || null,
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setAdjMsg(json?.error || `Gagal adjust (${res.status})`);
        return;
      }

      setAdjOpen(false);
      resetAdj();
      await loadAll();
      setTab("balances");
    } catch (e: any) {
      setAdjMsg(e?.message || "Gagal stock adjustment.");
    } finally {
      setAdjBusy(false);
    }
  }

  const filteredBal = filteredBalances(balances, q, onlyHasStock);
  const filteredLed = filteredLedger(ledger, ledgerQ);

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Stock Gudang</h1>
          <p style={{ marginTop: 6, color: "#666" }}>
            {wh ? `${wh.code} • ${wh.name}` : loading ? "Loading..." : "—"}
          </p>
          {wh ? (
            <div style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
              {wh.phone ? `${wh.phone} • ` : ""}
              {wh.address}
            </div>
          ) : null}
          {err ? <div style={{ marginTop: 10, ...errBox() }}>{err}</div> : null}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/warehouses" style={btnSoftLink()}>
            Kembali
          </Link>
          <button onClick={() => loadAll()} style={btnSoft()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          {wh ? (
            <button onClick={() => router.push(`/warehouses/${wh.id}/edit`)} style={btnSoft()}>
              Edit Gudang
            </button>
          ) : null}

          <button
            onClick={() => {
              if (!canAdjust) return setErr("Role kamu tidak boleh stock adjustment (admin/owner only).");
              resetAdj();
              setAdjOpen(true);
            }}
            style={btnPrimary()}
            disabled={loading || !wh}
            title={canAdjust ? "Koreksi stok manual" : "Admin/Owner only"}
          >
            Stock Adjustment
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, ...card() }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setTab("balances")} style={tab === "balances" ? tabBtnActive() : tabBtn()}>
              Inventory Balance
            </button>
            <button onClick={() => setTab("ledger")} style={tab === "ledger" ? tabBtnActive() : tabBtn()}>
              Stock Ledger
            </button>
          </div>

          {tab === "balances" ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 900, color: "#6b7280" }}>
                Total On Hand: <span style={{ color: "#111" }}>{totalOnHand.toLocaleString("id-ID")}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={String(ledgerLimit)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setLedgerLimit(Number.isFinite(n) ? n : 100);
                }}
                style={input()}
              >
                <option value="50">Last 50</option>
                <option value="100">Last 100</option>
                <option value="200">Last 200</option>
                <option value="500">Last 500</option>
              </select>
              <button onClick={() => reloadLedgerOnly()} style={btnSoft()} disabled={loading}>
                Reload Ledger
              </button>
            </div>
          )}
        </div>

        {tab === "balances" ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari item..." style={inpFull()} />
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 900, color: "#6b7280", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={onlyHasStock} onChange={(e) => setOnlyHasStock(e.target.checked)} />
                hanya yang ada stok
              </label>
              <div style={{ fontWeight: 900, color: "#6b7280", whiteSpace: "nowrap" }}>{filteredBal.length} item</div>
            </div>

            <div style={{ marginTop: 10, ...tableWrap() }}>
              <table style={table()}>
                <thead>
                  <tr>
                    <th style={th()}>Item</th>
                    <th style={th()}>Key</th>
                    <th style={{ ...th(), textAlign: "right" }}>On Hand</th>
                    <th style={th()}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td style={td()} colSpan={4}>
                        Loading...
                      </td>
                    </tr>
                  ) : filteredBal.length === 0 ? (
                    <tr>
                      <td style={td()} colSpan={4}>
                        Belum ada stock di gudang ini.
                      </td>
                    </tr>
                  ) : (
                    filteredBal.map((r, idx) => (
                      <tr key={`${r.item_key}-${idx}`}>
                        <td style={td()}>
                          <div style={{ fontWeight: 950 }}>{r.item_name || "-"}</div>
                        </td>
                        <td style={tdMono()}>{r.item_key || "-"}</td>
                        <td style={{ ...td(), textAlign: "right" }}>{Math.floor(num(r.on_hand)).toLocaleString("id-ID")}</td>
                        <td style={tdMuted()}>{fmtDT(r.updated_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12 }}>
              Inventory Balance = posisi stok terakhir per item di gudang.
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
              <input value={ledgerQ} onChange={(e) => setLedgerQ(e.target.value)} placeholder="Cari ledger: nama barang / ref..." style={inpFull()} />
              <div style={{ fontWeight: 900, color: "#6b7280", whiteSpace: "nowrap" }}>{filteredLed.length} baris</div>
            </div>

            <div style={{ marginTop: 10, ...tableWrap() }}>
              <table style={table()}>
                <thead>
                  <tr>
                    <th style={th()}>Tanggal</th>
                    <th style={th()}>Barang</th>
                    <th style={th()}>Ref</th>
                    <th style={{ ...th(), textAlign: "right" }}>In</th>
                    <th style={{ ...th(), textAlign: "right" }}>Out</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td style={td()} colSpan={5}>
                        Loading...
                      </td>
                    </tr>
                  ) : filteredLed.length === 0 ? (
                    <tr>
                      <td style={td()} colSpan={5}>
                        Belum ada pergerakan stok.
                      </td>
                    </tr>
                  ) : (
                    filteredLed.map((r) => (
                      <tr key={r.id}>
                        <td style={tdMuted()}>{fmtDT(r.created_at)}</td>
                        <td style={td()}>
                          <div style={{ fontWeight: 950 }}>{r.product_name || "-"}</div>
                        </td>
                        <td style={tdMono()}>
                          {(r.ref_type || "-") + (r.ref_id ? `:${String(r.ref_id).slice(0, 8)}…` : "")}
                        </td>
                        <td style={{ ...td(), textAlign: "right" }}>{Math.max(0, Math.floor(num(r.qty_in))).toLocaleString("id-ID")}</td>
                        <td style={{ ...td(), textAlign: "right" }}>{Math.max(0, Math.floor(num(r.qty_out))).toLocaleString("id-ID")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12 }}>
              Stock Ledger = riwayat transaksi masuk/keluar (contoh: GRN/Receive, Adjustment).
            </div>
          </div>
        )}
      </div>

      {adjOpen ? (
        <div style={modalOverlay()}>
          <div style={modalCard()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 1000 }}>Stock Adjustment</div>
                <div style={{ marginTop: 4, color: "#6b7280", fontWeight: 800, fontSize: 12 }}>
                  Koreksi stok manual akan masuk ke <b>Stock Ledger</b> dan update <b>Inventory Balance</b>.
                </div>
              </div>
              <button
                onClick={() => {
                  if (adjBusy) return;
                  setAdjOpen(false);
                }}
                style={btnSoft()}
              >
                Tutup
              </button>
            </div>

            {adjMsg ? <div style={{ marginTop: 10, ...errBox() }}>{adjMsg}</div> : null}

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={card()}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Pilih Barang</div>

                <select
                  value={adjProductId}
                  onChange={(e) => setAdjProductId(e.target.value)}
                  style={inpFull()}
                >
                  <option value="">— pilih dari master barang —</option>
                  {products.map((p) => {
                    const key = productToItemKey(p);
                    const onHand = balances.find(
                      (b) => String(b.item_key || "").trim().toLowerCase() === key.toLowerCase()
                    )?.on_hand;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({key}) • on_hand: {Math.floor(num(onHand || 0))}
                      </option>
                    );
                  })}
                </select>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <label style={label()}>
                    Product ID
                    <input value={adjProductId} readOnly style={inpFull()} placeholder="auto dari product" />
                  </label>

                  <label style={label()}>
                    Item Key
                    <input value={adjItemKey} readOnly style={inpFull()} placeholder="auto dari product" />
                  </label>

                  <label style={label()}>
                    Item Name
                    <input value={adjItemName} readOnly style={inpFull()} placeholder="auto dari product" />
                  </label>
                </div>

                <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12, fontWeight: 800 }}>
                  On hand saat ini di gudang ini: <b>{Math.floor(num(adjCurrentOnHand)).toLocaleString("id-ID")}</b>
                </div>
              </div>

              <div style={card()}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Koreksi</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={label()}>
                    Arah
                    <select value={adjDir} onChange={(e) => setAdjDir(e.target.value as any)} style={inpFull()}>
                      <option value="in">Tambah stok (+)</option>
                      <option value="out">Kurangi stok (-)</option>
                    </select>
                  </label>

                  <label style={label()}>
                    Qty
                    <input
                      value={adjQtyText}
                      onChange={(e) => setAdjQtyText(e.target.value)}
                      style={inpFull()}
                      inputMode="numeric"
                      placeholder="contoh: 5"
                    />
                  </label>
                </div>

                <label style={{ ...label(), marginTop: 10 }}>
                  Catatan (optional)
                  <textarea
                    value={adjNote}
                    onChange={(e) => setAdjNote(e.target.value)}
                    style={{ ...inpFull(), minHeight: 90, height: "auto" }}
                    placeholder="contoh: koreksi stok opname / barang rusak / selisih input"
                  />
                </label>

                <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => {
                      if (adjBusy) return;
                      setAdjOpen(false);
                    }}
                    style={btnSoft()}
                    disabled={adjBusy}
                  >
                    Batal
                  </button>
                  <button onClick={submitAdjustment} style={btnPrimary()} disabled={adjBusy}>
                    {adjBusy ? "Processing..." : "Post Adjustment"}
                  </button>
                </div>

                <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12, fontWeight: 800 }}>
                  Adjustment sekarang wajib pilih dari master barang agar stok linked ke product.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function filteredBalances(rows: BalanceRow[], q: string, onlyHasStock: boolean) {
  const s = q.trim().toLowerCase();
  let list = rows || [];

  if (onlyHasStock) list = list.filter((r) => num(r.on_hand) > 0);

  if (!s) return list;

  return list.filter((r) => {
    const blob = `${r.item_key || ""} ${r.item_name || ""}`.toLowerCase();
    return blob.includes(s);
  });
}

function filteredLedger(rows: LedgerRow[], q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return rows;
  return (rows || []).filter((r) => {
    const blob = `${r.product_name || ""} ${r.ref_type || ""} ${r.ref_id || ""}`.toLowerCase();
    return blob.includes(s);
  });
}

function card(): React.CSSProperties {
  return { border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white", boxSizing: "border-box" };
}
function errBox(): React.CSSProperties {
  return { padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 900 };
}
function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 13, color: "#444", fontWeight: 900 };
}
function input(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", outline: "none", fontWeight: 800, background: "white", height: 42, boxSizing: "border-box" };
}
function inpFull(): React.CSSProperties {
  return { ...input(), width: "100%" };
}
function tableWrap(): React.CSSProperties {
  return { width: "100%", overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12 };
}
function table(): React.CSSProperties {
  return { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 980 };
}
function th(): React.CSSProperties {
  return { textAlign: "left", fontSize: 12, color: "#6b7280", fontWeight: 950, padding: "10px 12px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb", position: "sticky", top: 0, zIndex: 1 };
}
function td(): React.CSSProperties {
  return { padding: "10px 12px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", fontWeight: 800, color: "#111827", background: "white" };
}
function tdMono(): React.CSSProperties {
  return { ...td(), fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" };
}
function tdMuted(): React.CSSProperties {
  return { ...td(), color: "#6b7280", fontWeight: 800 };
}
function btnSoftLink(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 900, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" };
}
function btnSoft(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 1000, cursor: "pointer", whiteSpace: "nowrap" };
}
function tabBtn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 900, cursor: "pointer" };
}
function tabBtnActive(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 900, cursor: "pointer" };
}
function modalOverlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: 18,
    zIndex: 9999,
    overflowY: "auto",
  };
}
function modalCard(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 980,
    borderRadius: 16,
    background: "white",
    border: "1px solid #e5e7eb",
    boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
    padding: 16,
    marginTop: 18,
  };
}