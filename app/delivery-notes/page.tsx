import { supabaseServer } from "@/lib/supabase/server";

export default async function DeliveryNotesListPage() {
  const supabase = await supabaseServer();

  const { data: rows } = await supabase
    .from("delivery_notes")
    .select("id, sj_number, sj_date, invoice_id, invoices(invoice_number, customer_name)")
    .order("created_at", { ascending: false });

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Surat Jalan</h1>
          <p style={{ marginTop: 6, color: "#666" }}>Dibuat dari Invoice</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/dashboard" style={btn()}>Dashboard</a>
          <a href="/invoice" style={btn()}>Invoice</a>
        </div>
      </div>

      <div style={{ marginTop: 14, ...card() }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th()}>Nomor SJ</th>
                <th style={th()}>Tanggal</th>
                <th style={th()}>Invoice</th>
                <th style={th()}>Customer</th>
                <th style={th()}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r: any) => (
                <tr key={r.id}>
                  <td style={td()}>{r.sj_number}</td>
                  <td style={td()}>{r.sj_date}</td>
                  <td style={td()}>{r.invoices?.invoice_number}</td>
                  <td style={td()}>{r.invoices?.customer_name}</td>
                  <td style={td()}>
                    <a href={`/delivery-notes/${r.id}`} style={miniLink()}>View</a>
                    <a href={`/api/delivery-notes/pdf/${r.id}`} style={miniLink()} target="_blank" rel="noreferrer">
                      Download PDF
                    </a>
                  </td>
                </tr>
              ))}
              {(rows || []).length === 0 ? (
                <tr><td style={td()} colSpan={5}>Belum ada Surat Jalan.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function card(): React.CSSProperties {
  return { border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white" };
}
function btn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", textDecoration: "none", color: "#111" };
}
function th(): React.CSSProperties {
  return { textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px", color: "#666", fontWeight: 600 };
}
function td(): React.CSSProperties {
  return { borderBottom: "1px solid #f2f2f2", padding: "8px 6px" };
}
function miniLink(): React.CSSProperties {
  return { marginRight: 10, color: "#111", textDecoration: "underline" };
}