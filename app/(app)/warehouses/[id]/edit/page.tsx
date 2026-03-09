// ✅ NEW FILE
// invoiceku/app/(app)/warehouses/[id]/edit/page.tsx
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Row = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string;
  is_active: boolean;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export default function WarehouseEditPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [row, setRow] = useState<Row | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        setMsg("Unauthorized");
        setRow(null);
        return;
      }

      const { data, error } = await supabase
        .from("warehouses")
        .select("id,code,name,phone,address,is_active")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setMsg("Gudang tidak ditemukan.");
        setRow(null);
        return;
      }

      const r = data as any as Row;
      setRow(r);

      setCode(r.code || "");
      setName(r.name || "");
      setPhone(r.phone || "");
      setAddress(r.address || "");
      setIsActive(!!r.is_active);
    } catch (e: any) {
      setMsg(e?.message || "Gagal load gudang.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setMsg("");
    if (!safeStr(code)) return setMsg("Kode gudang wajib diisi.");
    if (!safeStr(name)) return setMsg("Nama gudang wajib diisi.");
    if (!safeStr(address)) return setMsg("Alamat gudang wajib diisi.");

    setSaving(true);
    try {
      const { error } = await supabase
        .from("warehouses")
        .update({
          code: safeStr(code),
          name: safeStr(name),
          phone: safeStr(phone) || null,
          address: safeStr(address),
          is_active: isActive,
        })
        .eq("id", id);

      if (error) throw error;

      router.push("/warehouses");
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || "Gagal simpan.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div style={{ padding: 18, maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Edit Gudang</h1>
          <p style={{ marginTop: 6, color: "#666" }}>
            {row ? `${row.code} • ${row.name}` : "—"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/warehouses" style={btn()}>
            Kembali
          </Link>
          <button onClick={save} disabled={saving || loading || !row} style={btnPrimary()}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, ...card() }}>
        {loading ? (
          <div>Loading...</div>
        ) : !row ? (
          <div style={{ color: "#b00", fontWeight: 900 }}>{msg || "Tidak ada data."}</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <label style={label()}>
              Kode Gudang
              <input value={code} onChange={(e) => setCode(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Nama Gudang
              <input value={name} onChange={(e) => setName(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              No Telp (optional)
              <input value={phone} onChange={(e) => setPhone(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Alamat
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ ...input(), minHeight: 90, resize: "vertical" }}
              />
            </label>

            <label style={{ ...label(), display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Gudang aktif
            </label>

            {msg ? <div style={{ color: "#b00", fontWeight: 900 }}>{msg}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function card(): React.CSSProperties {
  return { border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white", boxSizing: "border-box" };
}
function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 13, color: "#444", fontWeight: 800 };
}
function input(): React.CSSProperties {
  return { padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%", boxSizing: "border-box", outline: "none", background: "white" };
}
function btn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer", textDecoration: "none", color: "#111", fontWeight: 900 };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", cursor: "pointer", fontWeight: 900 };
}
