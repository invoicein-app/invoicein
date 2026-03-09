// ✅ NEW FILE
// invoiceku/app/(app)/warehouses/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

function fmtDateTime(iso: any) {
  if (!iso) return "-";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WarehouseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [row, setRow] = useState<Warehouse | null>(null);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/warehouses/${encodeURIComponent(id)}`, {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setRow(null);
        setMsg(json?.error || `Gagal load (${res.status})`);
        return;
      }
      setRow((json?.warehouse as Warehouse) || null);
    } catch (e: any) {
      setRow(null);
      setMsg(e?.message || "Gagal load gudang.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  return (
    <div style={{ padding: 18, maxWidth: 900, margin: "0 auto" }}>
      <div style={topbar()}>
        <div>
          <h1 style={{ margin: 0 }}>Detail Gudang</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            {row ? `${row.code} • ${row.name}` : "—"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/warehouses" style={btn()}>
            Kembali
          </Link>

          <button onClick={load} style={btn()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>

          {row ? (
            <Link href={`/warehouses/${row.id}/edit`} style={btnPrimary()}>
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      {msg ? <div style={errBox()}>{msg}</div> : null}

      <div style={card()}>
        {loading ? (
          <div>Loading...</div>
        ) : !row ? (
          <div style={{ fontWeight: 900, color: "#991b1b" }}>Data tidak ditemukan.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <Row k="Kode" v={row.code} />
            <Row k="Nama" v={row.name} />
            <Row k="No Telp" v={row.phone || "-"} />
            <Row k="Alamat" v={row.address || "-"} />
            <Row k="Status" v={<span style={{ ...pill(), ...(row.is_active ? pillOk() : pillOff()) }}>{row.is_active ? "aktif" : "nonaktif"}</span>} />
            <Row k="Dibuat" v={fmtDateTime(row.created_at)} />
            <Row k="Diupdate" v={fmtDateTime(row.updated_at)} />
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <Link href="/warehouses" style={{ ...btn(), display: "inline-block" }}>
          ← Kembali ke List
        </Link>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10 }}>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 950 }}>{k}</div>
      <div style={{ fontWeight: 900, color: "#111827" }}>{v}</div>
    </div>
  );
}

/** styles */
function topbar(): React.CSSProperties {
  return { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 };
}
function card(): React.CSSProperties {
  return { border: "1px solid #e5e7eb", background: "white", borderRadius: 14, padding: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" };
}
function errBox(): React.CSSProperties {
  return { marginBottom: 12, padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 900 };
}
function btn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 900, textDecoration: "none", cursor: "pointer" };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 900, textDecoration: "none" };
}
function pill(): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 950, border: "1px solid #e5e7eb" };
}
function pillOk(): React.CSSProperties {
  return { background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" };
}
function pillOff(): React.CSSProperties {
  return { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" };
}
