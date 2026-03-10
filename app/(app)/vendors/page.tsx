"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import ListPageLayout from "../components/list-page-layout";
import ListFiltersClient from "../components/list-filters-client";
import { listTableStyles } from "../components/list-page-layout";

type VendorRow = {
  id: string;
  vendor_code: string;
  name: string;
  phone: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

function fmtDate(iso: any) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function VendorsListPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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

      const { data, error } = await supabase
        .from("vendors")
        .select("id,vendor_code,name,phone,is_active,created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;

      setRows((data as any) || []);
    } catch (e: any) {
      setErr(e?.message || "Gagal load vendors.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const blob = `${r.vendor_code} ${r.name} ${r.phone || ""} ${r.is_active ? "active" : "inactive"}`.toLowerCase();
      return blob.includes(s);
    });
  }, [rows, q]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  const paginated = useMemo(() => filtered.slice(fromIdx, fromIdx + pageSize), [filtered, fromIdx, pageSize]);

  const clientPagination = useMemo(
    () => ({
      onFirst: () => setPage(1),
      onPrev: () => setPage((p) => Math.max(1, p - 1)),
      onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
      onLast: () => setPage(totalPages),
    }),
    [totalPages]
  );

  async function deactivateVendor(id: string) {
    const v = rows.find((x) => x.id === id);
    if (!v) return;

    const ok = confirm(`Nonaktifkan vendor ${v.vendor_code} - ${v.name}?`);
    if (!ok) return;

    const res = await fetch(`/api/vendors/${id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json?.error || "Gagal nonaktifkan vendor");
      return;
    }
    await load();
  }

  const filters = (
    <ListFiltersClient
      searchPlaceholder="Cari vendor code / nama / phone..."
      searchValue={q}
      onSearchChange={setQ}
      onReset={() => { setQ(""); setPage(1); }}
      perPage={pageSize}
      onPerPageChange={(v) => { setPageSize(v); setPage(1); }}
      perPageOptions={[10, 20, 30, 50]}
    >
      <button type="button" onClick={load} style={btnSoft()} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
    </ListFiltersClient>
  );

  const tableContent = (
    <table style={{ ...listTableStyles.table, minWidth: 920 }}>
      <thead>
        <tr style={listTableStyles.thead}>
          <th style={listTableStyles.th}>Vendor Code</th>
          <th style={listTableStyles.th}>Nama</th>
          <th style={listTableStyles.th}>Phone</th>
          <th style={listTableStyles.th}>Status</th>
          <th style={listTableStyles.th}>Created</th>
          <th style={listTableStyles.th}>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={6} style={listTableStyles.td}>Loading...</td></tr>
        ) : paginated.length === 0 ? (
          <tr><td colSpan={6} style={listTableStyles.empty}>Tidak ada data.</td></tr>
        ) : (
          paginated.map((r) => {
            const active = r.is_active !== false;
            return (
              <tr key={r.id}>
                <td style={{ ...listTableStyles.td, fontFamily: "ui-monospace, monospace" }}>
                  <Link href={`/vendors/${r.id}`} style={linkClick()}>{r.vendor_code || "-"}</Link>
                </td>
                <td style={listTableStyles.td}><div style={{ fontWeight: 700 }}>{r.name}</div></td>
                <td style={listTableStyles.td}>{r.phone || "-"}</td>
                <td style={listTableStyles.td}>
                  <span style={{ ...pill(), ...(active ? pillOk() : pillBad()) }}>{active ? "active" : "inactive"}</span>
                </td>
                <td style={listTableStyles.td}>{fmtDate(r.created_at)}</td>
                <td style={listTableStyles.td}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => router.push(`/vendors/${r.id}`)} style={btnSoftSmall()}>Detail</button>
                    <button type="button" onClick={() => router.push(`/vendors/${r.id}/edit`)} style={btnSoftSmall()}>Edit</button>
                    <button type="button" onClick={() => deactivateVendor(r.id)} disabled={!active} style={{ ...btnDangerSmall(), cursor: !active ? "not-allowed" : "pointer", opacity: !active ? 0.5 : 1 }} title={!active ? "Sudah inactive" : "Nonaktifkan vendor"}>Deactivate</button>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  return (
    <>
      {err ? <div style={{ ...errBox(), margin: "24px 0" }}>{err}</div> : null}
      <ListPageLayout
        title="Vendors"
        subtitle="Master vendor (dengan vendor code otomatis)."
        primaryLink={{ href: "/vendors/new", label: "+ Buat Vendor" }}
        secondaryLink={{ href: "/invoice", label: "Invoice" }}
        filters={filters}
        totalRows={totalRows}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        fromIdx={fromIdx}
        toIdx={toIdx}
        clientPagination={clientPagination}
        tableContent={tableContent}
        emptyMessage="Tidak ada data."
      />
    </>
  );
}

/** styles */
function topbar(): React.CSSProperties {
  return { display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 };
}
function card(): React.CSSProperties {
  return { border: "1px solid #e5e7eb", background: "white", borderRadius: 14, padding: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" };
}
function errBox(): React.CSSProperties {
  return { marginBottom: 12, padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 900 };
}
function baseInput(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", outline: "none", fontWeight: 800, background: "white", lineHeight: "20px", height: 42, boxSizing: "border-box" };
}
function inpFull(): React.CSSProperties {
  return { ...baseInput(), width: "100%" };
}
function btnSoft(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none", display: "inline-block" };
}
function btnPrimaryLink(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none", display: "inline-block" };
}
function tableWrap(): React.CSSProperties {
  return { width: "100%", overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12 };
}
function table(): React.CSSProperties {
  return { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 920 };
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
function linkClick(): React.CSSProperties {
  return { color: "#111827", textDecoration: "underline", fontWeight: 1000, cursor: "pointer", pointerEvents: "auto" };
}
function btnSoftSmall(): React.CSSProperties {
  return { padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" };
}
function btnDangerSmall(): React.CSSProperties {
  return { padding: "8px 10px", borderRadius: 10, border: "1px solid #b00", background: "#fff5f5", color: "#b00", fontWeight: 900, whiteSpace: "nowrap" };
}
function pill(): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 950, textTransform: "lowercase" };
}
function pillOk(): React.CSSProperties {
  return { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" };
}
function pillBad(): React.CSSProperties {
  return { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" };
}
