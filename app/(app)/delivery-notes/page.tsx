import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

function badgeStyle(status: string) {
  const s = String(status || "").toLowerCase();

  if (s === "posted") {
    return {
      bg: "#ecfdf5",
      border: "#6ee7b7",
      color: "#065f46",
      label: "POSTED",
    };
  }

  if (s === "cancelled") {
    return {
      bg: "#fef2f2",
      border: "#fca5a5",
      color: "#991b1b",
      label: "CANCELLED",
    };
  }

  return {
    bg: "#f3f4f6",
    border: "#d1d5db",
    color: "#374151",
    label: "DRAFT",
  };
}

export default async function DeliveryNotesListPage() {
  const supabase = await supabaseServer();

  const { data: rows, error } = await supabase
    .from("delivery_notes")
    .select(
      "id, sj_number, sj_date, status, invoice_id, invoices(invoice_number, customer_name)"
    )
    .order("created_at", { ascending: false });

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
            Surat Jalan
          </h1>
          <div style={{ color: "#666", marginTop: 4 }}>
            Dibuat dari invoice dan bisa jadi trigger stok sesuai pengaturan organisasi
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/dashboard" style={btnSoftLink()}>
            Dashboard
          </Link>
          <Link href="/invoice" style={btnSoftLink()}>
            Invoice
          </Link>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 14,
          border: "1px solid #eee",
          background: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 800, color: "#111" }}>Daftar Surat Jalan</div>
          <div style={{ color: "#666", fontSize: 13 }}>
            Total: <b>{rows?.length || 0}</b>
          </div>
        </div>

        {error ? (
          <div style={errBox()}>
            {error.message}
          </div>
        ) : null}

        <div
          style={{
            marginTop: 12,
            border: "1px solid #eee",
            borderRadius: 14,
            overflowX: "auto",
            background: "white",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#fafafa", color: "#555" }}>
                <th style={{ ...th(), minWidth: 180 }}>Nomor SJ</th>
                <th style={th()}>Tanggal</th>
                <th style={{ ...th(), minWidth: 180 }}>Invoice</th>
                <th style={{ ...th(), minWidth: 180 }}>Customer</th>
                <th style={{ ...th(), textAlign: "center" }}>Status</th>
                <th style={{ ...th(), minWidth: 230 }}>Aksi</th>
              </tr>
            </thead>

            <tbody>
              {(rows || []).map((r: any) => {
                const badge = badgeStyle(r.status);

                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStrong()}>{r.sj_number || "-"}</td>
                    <td style={td()}>{r.sj_date || "-"}</td>
                    <td style={td()}>{r.invoices?.invoice_number || "-"}</td>
                    <td style={td()}>{r.invoices?.customer_name || "-"}</td>

                    <td style={{ ...td(), textAlign: "center" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.color,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>

                    <td style={td()}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link href={`/delivery-notes/${r.id}`} style={miniBtn()}>
                          View
                        </Link>

                        <a
                          href={`/api/delivery-notes/pdf/${r.id}`}
                          style={miniBtn()}
                          target="_blank"
                          rel="noreferrer"
                        >
                          PDF
                        </a>

                        <a
                          href={`/api/delivery-notes/pdf-dotmatrix/${r.id}`}
                          style={miniBtn()}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Dotmatrix
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {(rows || []).length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...td(), textAlign: "center", color: "#666", padding: 20 }}>
                    Belum ada Surat Jalan.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function btnSoftLink(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "white",
    textDecoration: "none",
    color: "#111",
    fontWeight: 600,
  };
}

function miniBtn(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "white",
    textDecoration: "none",
    color: "#111",
    fontWeight: 600,
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
  };
}

function th(): React.CSSProperties {
  return {
    textAlign: "left",
    padding: 12,
    borderBottom: "1px solid #eee",
    color: "#666",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}

function td(): React.CSSProperties {
  return {
    padding: 12,
    borderBottom: "1px solid #f2f2f2",
    verticalAlign: "middle",
  };
}

function tdStrong(): React.CSSProperties {
  return {
    ...td(),
    fontWeight: 800,
    color: "#111",
  };
}

function errBox(): React.CSSProperties {
  return {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontWeight: 700,
  };
}