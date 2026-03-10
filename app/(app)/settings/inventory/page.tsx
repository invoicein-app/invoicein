// ✅ NEW FILE
// app/settings/inventory/page.tsx

"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Warehouse = {
  id: string;
  name: string;
};

type Settings = {
  stock_issue_trigger: "invoice_sent" | "delivery_note_posted";
  default_warehouse_id: string | null;
  allow_negative_stock: boolean;
};

export default function InventorySettingsPage() {
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [orgId, setOrgId] = useState<string | null>(null);

  const [settings, setSettings] = useState<Settings>({
    stock_issue_trigger: "invoice_sent",
    default_warehouse_id: null,
    allow_negative_stock: true,
  });

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes.user;
        if (!user) return;

        const { data: mem } = await supabase
          .from("memberships")
          .select("org_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (!mem?.org_id) return;

        const org = mem.org_id;
        if (!alive) return;

        setOrgId(org);

        // load warehouses
        const { data: wh } = await supabase
          .from("warehouses")
          .select("id,name")
          .order("name", { ascending: true });

        if (alive) setWarehouses((wh || []) as any);

        // load settings
        const { data: setRow } = await supabase
          .from("org_settings")
          .select("stock_issue_trigger,default_warehouse_id,allow_negative_stock")
          .eq("org_id", org)
          .maybeSingle();

        if (alive && setRow) {
          setSettings({
            stock_issue_trigger: setRow.stock_issue_trigger,
            default_warehouse_id: setRow.default_warehouse_id,
            allow_negative_stock: setRow.allow_negative_stock,
          });
        }

        if (alive) setLoading(false);
      } catch {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  async function save() {
    if (!orgId) return;

    setSaving(true);
    setMsg("");

    try {
      const { error } = await supabase
        .from("org_settings")
        .update({
          stock_issue_trigger: settings.stock_issue_trigger,
          default_warehouse_id: settings.default_warehouse_id,
          allow_negative_stock: settings.allow_negative_stock,
        })
        .eq("org_id", orgId);

      if (error) {
        setMsg(error.message);
      } else {
        setMsg("Pengaturan inventory berhasil disimpan.");
      }
    } catch (e: any) {
      setMsg(e?.message || "Gagal menyimpan.");
    }

    setSaving(false);
  }

  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    background: "white",
  };

  const label: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
  };

  const input: React.CSSProperties = {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    width: "100%",
    marginTop: 6,
  };

  const btn: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  };

  return (
    <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
      <h2 style={{ marginBottom: 4 }}>Inventory Settings</h2>
      <div style={{ color: "#6b7280", marginBottom: 18 }}>
        Atur bagaimana sistem mengurangi stok barang.
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div style={card}>
          {/* STOCK TRIGGER */}
          <div style={{ marginBottom: 18 }}>
            <div style={label}>Stock Out Trigger</div>

            <div style={{ marginTop: 10 }}>
              <label style={{ display: "block", marginBottom: 6 }}>
                <input
                  type="radio"
                  checked={settings.stock_issue_trigger === "invoice_sent"}
                  onChange={() =>
                    setSettings((s) => ({
                      ...s,
                      stock_issue_trigger: "invoice_sent",
                    }))
                  }
                />{" "}
                Kurangi stok saat <b>Invoice Sent</b>
              </label>

              <label style={{ display: "block" }}>
                <input
                  type="radio"
                  checked={settings.stock_issue_trigger === "delivery_note_posted"}
                  onChange={() =>
                    setSettings((s) => ({
                      ...s,
                      stock_issue_trigger: "delivery_note_posted",
                    }))
                  }
                />{" "}
                Kurangi stok saat <b>Surat Jalan dibuat</b>
              </label>
            </div>

            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
              Pilih salah satu metode pencatatan barang keluar.
            </div>
          </div>

          {/* DEFAULT WAREHOUSE */}
          <div style={{ marginBottom: 18 }}>
            <div style={label}>Default Warehouse</div>

            <select
              style={input}
              value={settings.default_warehouse_id || ""}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  default_warehouse_id: e.target.value || null,
                }))
              }
            >
              <option value="">- pilih gudang -</option>

              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
              Gudang default yang digunakan saat transaksi stok membutuhkan gudang.
            </div>
          </div>

          {/* NEGATIVE STOCK */}
          <div style={{ marginBottom: 20 }}>
            <div style={label}>Allow Negative Stock</div>

            <label style={{ display: "block", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={settings.allow_negative_stock}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    allow_negative_stock: e.target.checked,
                  }))
                }
              />{" "}
              Izinkan stok menjadi minus
            </label>

            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
              Jika dimatikan, sistem akan menolak transaksi ketika stok tidak cukup.
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button style={btn} onClick={save} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>

            {msg && <div style={{ fontSize: 13, color: "#065f46" }}>{msg}</div>}
          </div>
        </div>
      )}
    </div>
  );
}