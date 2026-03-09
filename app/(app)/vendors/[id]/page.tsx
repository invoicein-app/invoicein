// ✅ NEW FILE
// invoiceku/app/(app)/vendors/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Vendor = {
  id: string;
  vendor_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function fmtDateTime(iso: any) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function VendorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [v, setV] = useState<Vendor | null>(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/vendors/${encodeURIComponent(id)}`, { method: "GET", credentials: "include" });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || "Gagal load vendor.");

      setV(json.vendor as any);
    } catch (e: any) {
      setErr(e?.message || "Gagal load vendor.");
      setV(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const active = v?.is_active !== false;

  return (
    <div style={{ padding: 6 }}>
      <div style={topbar()}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Detail Vendor</div>
          <div style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}>
            {v?.vendor_code || "-"} • {v?.name || "-"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/vendors")} style={btnSoft()} disabled={loading}>
            Kembali
          </button>
          {v?.id ? (
            <Link href={`/vendors/${v.id}/edit`} style={btnSoftLink()}>
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      {err ? <div style={errBox()}>{err}</div> : null}

      <div style={grid()}>
        <div style={card()}>
          <div style={sectionTitle()}>Vendor</div>

          {loading ? (
            <div>Loading...</div>
          ) : !v ? (
            <div>-</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={row()}>
                <div style={k()}>Vendor Code</div>
                <div style={vVal()}>{v.vendor_code}</div>
              </div>
              <div style={row()}>
                <div style={k()}>Nama</div>
                <div style={vVal()}>{v.name}</div>
              </div>
              <div style={row()}>
                <div style={k()}>Phone</div>
                <div style={vVal()}>{v.phone || "-"}</div>
              </div>
              <div style={row()}>
                <div style={k()}>Email</div>
                <div style={vVal()}>{v.email || "-"}</div>
              </div>
              <div style={row()}>
                <div style={k()}>Alamat</div>
                <div style={vVal()}>{v.address || "-"}</div>
              </div>

              {v.note ? (
                <div style={{ marginTop: 10 }}>
                  <div style={k()}>Catatan</div>
                  <div style={{ marginTop: 6, fontWeight: 850, color: "#111827" }}>{v.note}</div>
                </div>
              ) : null}

              <div style={{ marginTop: 10 }}>
                <div style={k()}>Status</div>
                <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ ...pill(), ...(active ? pillOk() : pillBad()) }}>{active ? "active" : "inactive"}</span>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={k()}>Created</div>
                <div style={{ marginTop: 6, fontWeight: 900 }}>{fmtDateTime(v.created_at)}</div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={k()}>Updated</div>
                <div style={{ marginTop: 6, fontWeight: 900 }}>{fmtDateTime(v.updated_at)}</div>
              </div>
            </div>
          )}
        </div>

        <div style={card()}>
          <div style={sectionTitle()}>Next</div>
          <div style={{ color: "#6b7280", fontWeight: 800, lineHeight: 1.6 }}>
            Nanti PO bisa pilih vendor dari master ini (dropdown/search).
          </div>
        </div>
      </div>
    </div>
  );
}

/** styles */
function topbar(): React.CSSProperties {
  return { display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 };
}
function grid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" };
}
function card(): React.CSSProperties {
  return { border: "1px solid #e5e7eb", background: "white", borderRadius: 14, padding: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" };
}
function sectionTitle(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 950, color: "#6b7280", marginBottom: 10, letterSpacing: 0.2 };
}
function btnSoft(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" };
}
function btnSoftLink(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none", display: "inline-flex", alignItems: "center" };
}
function errBox(): React.CSSProperties {
  return { marginBottom: 12, padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 900 };
}
function row(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, alignItems: "start" };
}
function k(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 950, color: "#6b7280" };
}
function vVal(): React.CSSProperties {
  return { fontWeight: 900, color: "#111827" };
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
