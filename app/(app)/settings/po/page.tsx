// ✅ NEW FILE
// invoiceku/app/(app)/settings/po/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function POSettingsPage() {
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [orgId, setOrgId] = useState("");
  const [showWarehouseName, setShowWarehouseName] = useState(true);

  async function load() {
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
        setMsg("Org tidak ditemukan.");
        return;
      }
      setOrgId(oid);

      const { data: row, error } = await supabase
        .from("po_settings")
        .select("organization_id, show_warehouse_name")
        .eq("organization_id", oid)
        .maybeSingle();

      // kalau belum ada row, seed default (biar simpel)
      if (!row) {
        const { error: insErr } = await supabase
          .from("po_settings")
          .insert({ organization_id: oid, show_warehouse_name: true });

        if (insErr) throw insErr;

        setShowWarehouseName(true);
        return;
      }

      if (error) throw error;

      setShowWarehouseName((row as any).show_warehouse_name ?? true);
    } catch (e: any) {
      setMsg(e?.message || "Gagal load PO settings.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      if (!orgId) throw new Error("Org belum kebaca.");

      const { error } = await supabase
        .from("po_settings")
        .upsert({
          organization_id: orgId,
          show_warehouse_name: !!showWarehouseName,
        });

      if (error) throw error;

      setMsg("Tersimpan ✅");
    } catch (e: any) {
      setMsg(e?.message || "Gagal simpan.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>PO Settings</h1>
          <p style={{ marginTop: 6, color: "#666" }}>Pengaturan tampilan PDF Purchase Order.</p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} style={btn()} disabled={loading || saving}>
            Refresh
          </button>
          <button onClick={save} style={btnPrimary()} disabled={loading || saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, ...card() }}>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 950, color: "#6b7280", fontSize: 12, letterSpacing: 0.2 }}>
              SHIP TO
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
              <input
                type="checkbox"
                checked={showWarehouseName}
                onChange={(e) => setShowWarehouseName(e.target.checked)}
              />
              Tampilkan nama gudang di PDF
            </label>

            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: "20px" }}>
              Catatan:
              <ul style={{ margin: "6px 0 0 18px" }}>
                <li>Alamat gudang tetap tampil (kalau ada datanya).</li>
                <li>No telp gudang tetap tampil terus (kalau ada datanya).</li>
                <li>Toggle ini cuma buat “Nama Gudang”.</li>
              </ul>
            </div>

            {msg ? <div style={{ fontWeight: 900, color: msg.includes("✅") ? "#166534" : "#b00" }}>{msg}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function card(): React.CSSProperties {
  return { border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white", boxSizing: "border-box" };
}
function btn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer", color: "#111", fontWeight: 900 };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", cursor: "pointer", fontWeight: 900 };
}
