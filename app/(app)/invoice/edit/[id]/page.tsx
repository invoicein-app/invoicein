"use client";

import { formPageClasses as fpc } from "../../../components/form-page-classes";
import {
  formPageBackLink,
  formPageHeaderActions,
} from "../../../components/app-action-buttons";
import FormSubmitButton from "../../../components/form-submit-button";
import { useSubmitGuard } from "../../../components/use-submit-guard";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { num, rupiah } from "@/lib/money";
import { computeInvoiceSaveTotals, lineAmountRupiah } from "@/lib/invoice-totals";
import {
  buildItemSuggestions,
  type ItemSuggestion,
  type ManualSuggestionSource,
} from "@/lib/invoice-item-suggestions";
import { formatBankAccountLabel, type CompanyBankAccount } from "@/lib/company-bank-accounts";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  price: number | null;
};

type ManualItem = ManualSuggestionSource & {
  last_used_at?: string | null;
};

type Item = {
  id: string;
  name: string;
  qty: number;
  price: number;
  sort_order: number;
  product_id?: string;
  item_key?: string;
  openSug?: boolean;
};

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
  const [products, setProducts] = useState<Product[]>([]);
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [inventoryEnabled, setInventoryEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingProd, setLoadingProd] = useState(true);
  const [loadingManualItems, setLoadingManualItems] = useState(true);
  const [saving, setSaving] = useState(false);
  const { tryBegin, end, isBlocked } = useSubmitGuard(setSaving);
  const [msg, setMsg] = useState("");
  const [latestManualPriceMap, setLatestManualPriceMap] = useState<Record<string, number>>({});
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(true);

  const currentStatus = String(inv?.status || "").toLowerCase();
  const amountPaid = Math.max(0, Number(inv?.amount_paid || 0));
  const isEditable = currentStatus !== "cancelled";

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

    invData.discount_value = Number(invData.discount_value ?? 0);
    invData.tax_value = Number(invData.tax_value ?? 0);

    setInv(invData);
    setBankAccountId(String(invData.bank_account_id || ""));
    setItems(
      ((itemData || []) as any[]).map((row) => ({
        ...row,
        openSug: false,
      }))
    );
    setLoading(false);
  }

  async function loadProducts() {
    setLoadingProd(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,sku,unit,price,is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      setProducts([]);
    } else {
      setProducts((data || []) as Product[]);
    }
    setLoadingProd(false);
  }

  async function loadManualItems() {
    setLoadingManualItems(true);
    try {
      const res = await fetch("/api/manual-items?limit=200", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      setManualItems(res.ok ? ((json?.items || []) as ManualItem[]) : []);
    } catch {
      setManualItems([]);
    } finally {
      setLoadingManualItems(false);
    }
  }

  async function loadBankAccounts() {
    setLoadingBankAccounts(true);
    try {
      const res = await fetch("/api/company-bank-accounts?active_only=1", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      setBankAccounts(res.ok ? ((json.items || []) as CompanyBankAccount[]) : []);
    } catch {
      setBankAccounts([]);
    } finally {
      setLoadingBankAccounts(false);
    }
  }

  async function loadInventorySetting() {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return;

    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const orgId = String(membership?.org_id || "").trim();
    if (!orgId) return;

    const { data } = await supabase
      .from("org_settings")
      .select("inventory_enabled")
      .eq("org_id", orgId)
      .maybeSingle();

    setInventoryEnabled(Boolean(data?.inventory_enabled));
  }

  useEffect(() => {
    if (!id) return;
    load();
    loadProducts();
    loadManualItems();
    loadBankAccounts();
    loadInventorySetting();
  }, [id]);

  function getSuggestionsFor(raw: string): ItemSuggestion[] {
    return buildItemSuggestions({
      query: raw,
      products,
      manualItems,
      inventoryEnabled,
      limit: 10,
    });
  }

  async function applyManualLatestPrice(rowIdx: number, name: string) {
    const customerId = String(inv?.customer_id || "").trim();
    if (!customerId) return;

    const itemKey = toKey(name);
    if (!itemKey) return;

    const current = items[rowIdx];
    if (!current || current.product_id) return;

    const cached = latestManualPriceMap[itemKey];
    if (cached != null && cached > 0) {
      patchItem(rowIdx, { price: cached, item_key: itemKey });
      return;
    }

    try {
      const qs = new URLSearchParams({ customer_id: customerId, item_key: itemKey });
      const res = await fetch(`/api/customer-item-latest-prices?${qs.toString()}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !(Number(json.latest_price) > 0)) return;

      const latest = Math.floor(Number(json.latest_price));
      setLatestManualPriceMap((prev) => ({ ...prev, [itemKey]: latest }));
      patchItem(rowIdx, { price: latest, item_key: itemKey });
    } catch {
      /* ignore */
    }
  }

  async function pickProductSuggestion(rowIdx: number, p: Product) {
    const itemKey = productToItemKey(p);
    let priceN = Math.max(0, Math.floor(Number(p.price || 0)));
    const customerId = String(inv?.customer_id || "").trim();

    if (customerId) {
      try {
        const qs = new URLSearchParams({ customer_id: customerId, product_id: p.id });
        const res = await fetch(`/api/customer-item-latest-prices?${qs.toString()}`, {
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && Number(json?.latest_price) > 0) {
          priceN = Math.floor(Number(json.latest_price));
        }
      } catch {
        /* ignore */
      }
    }

    patchItem(rowIdx, {
      product_id: p.id,
      name: String(p.name || ""),
      item_key: itemKey,
      price: priceN,
      openSug: false,
    });
  }

  async function pickManualSuggestion(rowIdx: number, m: ManualItem) {
    const displayName = String(m.display_name || "").trim();
    const itemKey = String(m.item_key || "").trim() || toKey(displayName);
    let priceN = 0;
    const customerId = String(inv?.customer_id || "").trim();

    if (customerId && itemKey) {
      const cached = latestManualPriceMap[itemKey];
      if (cached != null && cached > 0) {
        priceN = cached;
      } else {
        try {
          const qs = new URLSearchParams({ customer_id: customerId, item_key: itemKey });
          const res = await fetch(`/api/customer-item-latest-prices?${qs.toString()}`, {
            credentials: "include",
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && Number(json?.latest_price) > 0) {
            priceN = Math.floor(Number(json.latest_price));
            setLatestManualPriceMap((prev) => ({ ...prev, [itemKey]: priceN }));
          }
        } catch {
          /* ignore */
        }
      }
    }

    patchItem(rowIdx, {
      product_id: "",
      name: displayName,
      item_key: itemKey,
      price: priceN,
      openSug: false,
    });
  }

  const calc = useMemo(() => {
    if (!inv) return { sub: 0, disc: 0, tax: 0, total: 0 };

    const { subtotal, discountAmount, taxAmount, total } = computeInvoiceSaveTotals({
      items: items.map((it) => ({ qty: num(it.qty), price: num(it.price) })),
      discountType: "percent",
      discountValue: Math.max(0, Math.min(100, Number(inv.discount_value ?? 0))),
      taxPercent: Math.max(0, Math.min(100, Number(inv.tax_value ?? 0))),
    });

    return { sub: subtotal, disc: discountAmount, tax: taxAmount, total };
  }, [inv, items]);

  const remainingAfterEdit = Math.max(0, calc.total - amountPaid);
  const overpayment = Math.max(0, amountPaid - calc.total);

  function patchInv(p: any) {
    if (!isEditable) return;
    setInv((prev: any) => ({ ...prev, ...p }));
  }

  function patchItem(i: number, p: Partial<Item>) {
    if (!isEditable) return;
    setItems((prev) => prev.map((x, idx) => (idx === i ? ({ ...x, ...p } as any) : x)));
  }

  function addItem() {
    if (!isEditable) return;
    setItems((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: "",
        qty: 1,
        price: 0,
        sort_order: prev.length,
        openSug: false,
      } as any,
    ]);
  }

  function removeItem(i: number) {
    if (!isEditable) return;
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (isBlocked()) return;
    setMsg("");

    if (!isEditable) {
      return setMsg("Invoice ini tidak bisa diedit.");
    }

    if (!inv?.customer_name?.trim()) return setMsg("Customer name wajib diisi.");
    if (items.length === 0) return setMsg("Minimal 1 item.");
    if (items.some((it) => !String(it.name || "").trim())) return setMsg("Nama item tidak boleh kosong.");

    if (!tryBegin()) return;
    try {
      const res = await fetch(`/api/invoice/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          header: {
            invoice_date: inv.invoice_date,
            due_date: inv.due_date,
            customer_name: inv.customer_name,
            customer_phone: inv.customer_phone || "",
            customer_address: inv.customer_address || "",
            note: inv.note || "",
            bank_account_id: bankAccountId || null,
            discount_value: Number(inv.discount_value ?? 0),
            tax_value: Number(inv.tax_value ?? 0),
            warehouse_id: inv.warehouse_id || null,
          },
          items: items.map((it, idx) => ({
            product_id: String(it.product_id || "").trim(),
            name: it.name,
            item_key: String(it.item_key || "").trim(),
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
      end();
    }
  }

  if (loading) return <div style={{ padding: 18 }}>Loading...</div>;
  if (msg && !inv) return <div style={{ padding: 18, color: "#b00" }}>{msg}</div>;
  if (!inv) return <div style={{ padding: 18 }}>Invoice tidak ditemukan.</div>;

  return (
    <div className={fpc.page} style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
      <div className={fpc.header} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Edit Invoice</h1>
          <p style={{ marginTop: 6, color: "#666" }}>
            {inv.invoice_number} • status: {inv.status || "-"}
          </p>
        </div>
        <div className={fpc.headerActions} style={formPageHeaderActions()}>
          <a href={`/invoice/${id}`} style={formPageBackLink()}>
            Kembali
          </a>
        </div>
      </div>

      {!isEditable ? (
        <div style={warnBox()}>
          Invoice ini sudah <b>dibatalkan</b> dan tidak bisa diedit lagi.
        </div>
      ) : amountPaid > 0 ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #bae6fd",
            background: "#f0f9ff",
            color: "#0c4a6e",
            fontWeight: 600,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          Sudah terbayar <b>{rupiah(amountPaid)}</b>.
          {overpayment > 0 ? (
            <>
              {" "}
              Setelah simpan, total di bawah tagihan — kelebihan bayar{" "}
              <b>{rupiah(overpayment)}</b> (catat sebagai refund/kredit manual).
            </>
          ) : (
            <>
              {" "}
              Setelah simpan, sisa tagihan otomatis{" "}
              <b>{rupiah(remainingAfterEdit)}</b> — pembayaran tidak perlu dihapus.
            </>
          )}
        </div>
      ) : null}

      <div className={fpc.grid2} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
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
                disabled={!isEditable}
              />
            </label>

            <label style={label()}>
              Due Date
              <input
                type="date"
                value={inv.due_date || ""}
                onChange={(e) => patchInv({ due_date: e.target.value })}
                style={input()}
                disabled={!isEditable}
              />
            </label>

            <label style={label()}>
              Nama Customer
              <input
                value={inv.customer_name || ""}
                onChange={(e) => patchInv({ customer_name: e.target.value })}
                style={input()}
                disabled={!isEditable}
              />
            </label>

            <label style={label()}>
              No HP
              <input
                value={inv.customer_phone || ""}
                onChange={(e) => patchInv({ customer_phone: e.target.value })}
                style={input()}
                disabled={!isEditable}
              />
            </label>

            <label style={label()}>
              Alamat
              <textarea
                value={inv.customer_address || ""}
                onChange={(e) => patchInv({ customer_address: e.target.value })}
                style={{ ...input(), minHeight: 80 }}
                disabled={!isEditable}
              />
            </label>

            <label style={label()}>
              Rekening Pembayaran
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                style={input()}
                disabled={!isEditable}
              >
                <option value="">Default perusahaan</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {formatBankAccountLabel(b)}
                  </option>
                ))}
              </select>
              {loadingBankAccounts ? (
                <small style={{ color: "#666" }}>Loading rekening...</small>
              ) : (
                <small style={{ color: "#666" }}>
                  Rekening yang ditampilkan di PDF invoice.
                </small>
              )}
            </label>

            <label style={label()}>
              Catatan
              <textarea
                value={inv.note || ""}
                onChange={(e) => patchInv({ note: e.target.value })}
                style={{ ...input(), minHeight: 80 }}
                disabled={!isEditable}
              />
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
                disabled={!isEditable}
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
                disabled={!isEditable}
              />
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
        <div className={fpc.sectionHead} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Items</h3>
        </div>

        <div className={fpc.tableScroll} style={{ marginTop: 10, overflowX: "auto" }}>
          <table className="app-table--invoice-form app-table--invoice-form-edit" style={{ width: "100%", borderCollapse: "collapse" }}>
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
              {items.map((it, i) => {
                const sug = it.openSug ? getSuggestionsFor(it.name) : [];
                return (
                <tr key={it.id || i} className="inv-form-item-row">
                  <td className="inv-form-item-product" data-label="Nama" style={{ ...td(), position: "relative" }}>
                    <input
                      value={it.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        patchItem(i, {
                          name: v,
                          product_id: "",
                          item_key: inventoryEnabled ? "" : toKey(v),
                          openSug: true,
                        });
                      }}
                      onFocus={() => patchItem(i, { openSug: true })}
                      onBlur={(e) => {
                        const nameValue = e.target.value;
                        setTimeout(() => {
                          patchItem(i, { openSug: false });
                          void applyManualLatestPrice(i, nameValue);
                        }, 140);
                      }}
                      placeholder={
                        inventoryEnabled
                          ? "Pilih barang dari master"
                          : "Ketik nama item atau pilih dari daftar"
                      }
                      style={input()}
                      disabled={!isEditable}
                    />

                    {it.openSug && sug.length > 0 ? (
                      <div style={sugBox()}>
                        {sug.map((entry) => {
                          if (entry.kind === "product") {
                            const p = entry;
                            const priceN = Math.max(0, Math.floor(Number(p.price || 0)));
                            return (
                              <button
                                key={`p-${p.id}`}
                                type="button"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => pickProductSuggestion(i, p as Product)}
                                style={sugBtn()}
                              >
                                <div style={{ fontWeight: 900 }}>
                                  {p.name}
                                  <span style={{ marginLeft: 8, fontSize: 11, color: "#166534", fontWeight: 700 }}>
                                    Master Barang
                                  </span>
                                </div>
                                <div style={{ fontSize: 12, color: "#6b7280" }}>
                                  {p.sku ? `${p.sku} • ` : ""}
                                  {priceN ? `Rp ${priceN.toLocaleString("id-ID")}` : ""}
                                </div>
                              </button>
                            );
                          }

                          const m = entry;
                          const cachedPrice = latestManualPriceMap[m.item_key];
                          return (
                            <button
                              key={`m-${m.item_key}`}
                              type="button"
                              onMouseDown={(ev) => ev.preventDefault()}
                              onClick={() => pickManualSuggestion(i, m)}
                              style={sugBtn()}
                            >
                              <div style={{ fontWeight: 900 }}>
                                {m.display_name}
                                <span style={{ marginLeft: 8, fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>
                                  Riwayat Item
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: "#6b7280" }}>
                                key: {m.item_key}
                                {cachedPrice && cachedPrice > 0
                                  ? ` • Rp ${cachedPrice.toLocaleString("id-ID")}`
                                  : ""}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                      {loadingProd || loadingManualItems
                        ? "Loading barang..."
                        : `Master: ${products.length} • riwayat manual: ${manualItems.length}`}
                    </div>
                  </td>
                  <td className="inv-form-item-qty" data-label="Qty" style={td()}>
                    <input
                      type="number"
                      value={it.qty}
                      onChange={(e) => patchItem(i, { qty: Number(e.target.value || 0) })}
                      style={input()}
                      disabled={!isEditable}
                    />
                  </td>
                  <td className="inv-form-item-price" data-label="Harga" style={td()}>
                    <input
                      type="number"
                      value={it.price}
                      onChange={(e) => patchItem(i, { price: Number(e.target.value || 0) })}
                      style={input()}
                      disabled={!isEditable}
                    />
                  </td>
                  <td className="inv-form-item-total" data-label="Total" style={td()}>
                    {rupiah(lineAmountRupiah(it.qty, it.price))}
                  </td>
                  <td className="inv-form-item-actions" data-label="Aksi" style={td()}>
                    <button onClick={() => removeItem(i)} style={btn()} disabled={!isEditable}>
                      Hapus
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={addItem} style={btn()} disabled={!isEditable}>
              + Tambah Item
            </button>
          </div>
        </div>
      </div>

      <div className="app-form-page__submit-row" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        {msg ? (
          <p style={{ color: "#b00", margin: "0 auto 0 0", alignSelf: "center", fontSize: 14 }}>{msg}</p>
        ) : null}
        <FormSubmitButton
          busy={saving}
          busyLabel="Menyimpan..."
          onClick={save}
          disabled={!isEditable}
        >
          Simpan
        </FormSubmitButton>
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
  return { padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%", boxSizing: "border-box", outline: "none" };
}
function btn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer", textDecoration: "none", color: "#111" };
}
function warnBox(): React.CSSProperties {
  return { marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", fontWeight: 900 };
}
function th(): React.CSSProperties {
  return { textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px", color: "#666", fontWeight: 600, whiteSpace: "nowrap" };
}
function td(): React.CSSProperties {
  return { borderBottom: "1px solid #f2f2f2", padding: "8px 6px", verticalAlign: "top" };
}
function sugBox(): React.CSSProperties {
  return {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 50,
    marginTop: 4,
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
    maxHeight: 260,
    overflowY: "auto",
  };
}
function sugBtn(): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    border: "none",
    borderBottom: "1px solid #f3f4f6",
    background: "white",
    cursor: "pointer",
  };
}