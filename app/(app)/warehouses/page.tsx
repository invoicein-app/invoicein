// ✅ FULL REPLACE FILE
// invoiceku/app/(app)/warehouses/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Row = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string;
  is_active: boolean;
  created_at: string;
};

export default function WarehousesPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        setRows([]);
        setErr("Unauthorized");
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

      const orgId = String((membership as any)?.org_id || "");
      if (!orgId) {
        setRows([]);
        setErr("Org tidak ditemukan. Pastikan membership aktif.");
        return;
      }

      let qb = supabase
        .from("warehouses")
        .select("id,code,name,phone,address,is_active,created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(300);

      if (onlyActive) qb = qb.eq("is_active", true);

      const { data, error } = await qb;
      if (error) throw error;

      setRows((data as any) || []);
    } catch (e: any) {
      setErr(e?.message || "Gagal load gudang.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyActive]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const blob = `${r.code} ${r.name} ${r.phone || ""} ${r.address}`.toLowerCase();
      return blob.includes(s);
    });
  }, [rows, q]);

  function goEdit(id: string) {
    router.push(`/warehouses/${id}/edit`);
  }

  return (
    <div style={{ padding: 6 }}>
      <div style={topbar()}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Gudang</div>
          <div style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}>
            Master data gudang untuk Ship To di PO.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={load} style={btnSoft()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <Link href="/warehouses/new" style={btnPrimaryLink()}>
            + Buat Gudang
          </Link>
        </div>
      </div>

      {err ? <div style={errBox()}>{err}</div> : null}

      <div style={card()}>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode / nama / alamat..." style={inpFull()} />

          <div style={{ display: "flex", gap: 10, alignItems: "center", whiteSpace: "nowrap" }}>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 900, color: "#6b7280" }}>
              <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
              hanya aktif
            </label>
            <div style={{ fontWeight: 900, color: "#6b7280" }}>{filtered.length} data</div>
          </div>
        </div>

        <div style={tableWrap()}>
          <table style={table()}>
            <thead>
              <tr>
                <th style={th()}>Kode</th>
                <th style={th()}>Nama</th>
                <th style={th()}>Telp</th>
                <th style={th()}>Alamat</th>
                <th style={th()}>Status</th>
                <th style={th()}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td style={td()} colSpan={6}>
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td style={td()} colSpan={6}>
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => goEdit(r.id)}
                    style={trClickable()}
                    title="Klik untuk edit"
                  >
                    <td style={tdMono()}>{r.code}</td>
                    <td style={td()}>
                      <div style={{ fontWeight: 950 }}>{r.name}</div>
                    </td>
                    <td style={td()}>{r.phone || "-"}</td>
                    <td style={td()}>
                      <div style={{ maxWidth: 520, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.address}
                      </div>
                    </td>
                    <td style={td()}>
                      <span style={{ ...pill(), ...(r.is_active ? pillGreen() : pillRed()) }}>
                        {r.is_active ? "active" : "inactive"}
                      </span>
                    </td>
                    <td style={td()}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation(); // ✅ jangan trigger row click dobel
                            goEdit(r.id);
                          }}
                          style={btnSoftSmall()}
                        >
                          Edit
                        </button>
                        <button
                        type="button"
                        onClick={(e) => {
                         e.stopPropagation();
                        router.push(`/warehouses/${r.id}/stock`);
                          }}
                         style={btnSoftSmall()}
                          >
                        Stock
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** styles */
function topbar(): React.CSSProperties {
  return { display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 };
}
function card(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
  };
}
function errBox(): React.CSSProperties {
  return {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontWeight: 900,
  };
}
function baseInput(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontWeight: 800,
    background: "white",
    lineHeight: "20px",
    height: 42,
    boxSizing: "border-box",
  };
}
function inpFull(): React.CSSProperties {
  return { ...baseInput(), width: "100%" };
}
function btnSoft(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    textDecoration: "none",
    display: "inline-block",
  };
}
function btnPrimaryLink(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    textDecoration: "none",
    display: "inline-block",
  };
}
function tableWrap(): React.CSSProperties {
  return { width: "100%", overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12 };
}
function table(): React.CSSProperties {
  return { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 980 };
}
function th(): React.CSSProperties {
  return {
    textAlign: "left",
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 950,
    padding: "10px 12px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    position: "sticky",
    top: 0,
    zIndex: 1,
  };
}
function td(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
    fontWeight: 800,
    color: "#111827",
    background: "white",
  };
}
function tdMono(): React.CSSProperties {
  return { ...td(), fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" };
}
function btnSoftSmall(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "white",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
function trClickable(): React.CSSProperties {
  return { cursor: "pointer" };
}
function pill(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: 0.2,
    textTransform: "lowercase",
  };
}
function pillGreen(): React.CSSProperties {
  return { border: "1px solid #16a34a", background: "#dcfce7", color: "#14532d" };
}
function pillRed(): React.CSSProperties {
  return { border: "1px solid #dc2626", background: "#fee2e2", color: "#7f1d1d" };
}