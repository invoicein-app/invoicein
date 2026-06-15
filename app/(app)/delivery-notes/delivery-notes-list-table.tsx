import Link from "next/link";
import { tableActionSecondary } from "../components/app-action-buttons";
import TableEmptyState from "../components/table-empty-state";
import { deliveryNoteStatusBadge } from "@/lib/delivery-note-status";

export type DeliveryNoteRow = {
  id: string;
  sj_number: string | null;
  sj_date: string | null;
  status: string | null;
  invoice_id: string | null;
  customer_name: string | null;
  invoices?: { invoice_number: string | null; customer_name: string | null } | null;
};

function formatTanggalIndo(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function badgeStyle(status: string | null | undefined) {
  return deliveryNoteStatusBadge(status);
}

export default function DeliveryNotesListTable({ rows }: { rows: DeliveryNoteRow[] }) {
  return (
    <div className="delivery-notes-table-scroll">
      <table className="delivery-notes-list-table app-table--delivery-notes">
        <thead>
          <tr>
            <th className="dn-th dn-th--sj">Nomor SJ</th>
            <th className="dn-th dn-th--status">Status</th>
            <th className="dn-th dn-th--invoice">Invoice</th>
            <th className="dn-th dn-th--customer">Customer</th>
            <th className="dn-th dn-th--actions">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <TableEmptyState colSpan={5} message="Belum ada surat jalan." />
          ) : (
            rows.map((r) => {
              const badge = badgeStyle(r.status);
              const invNum = r.invoices?.invoice_number;
              const customer = r.customer_name || r.invoices?.customer_name || "-";

              return (
                <tr key={r.id}>
                  <td className="dn-td dn-td--sj">
                    <Link href={`/delivery-notes/${r.id}`} className="dn-sj-link">
                      {r.sj_number || "-"}
                    </Link>
                    <div className="dn-sj-meta">Tanggal: {formatTanggalIndo(r.sj_date)}</div>
                  </td>

                  <td className="dn-td dn-td--status">
                    <span
                      className="dn-status-badge"
                      style={{
                        background: badge.bg,
                        borderColor: badge.border,
                        color: badge.color,
                      }}
                    >
                      {badge.label}
                    </span>
                  </td>

                  <td className="dn-td dn-td--invoice">
                    {invNum ? (
                      <span className="dn-invoice-ref">{invNum}</span>
                    ) : r.invoice_id ? (
                      <span className="dn-muted">—</span>
                    ) : (
                      <span className="dn-tag-manual">Manual</span>
                    )}
                  </td>

                  <td className="dn-td dn-td--customer">{customer}</td>

                  <td className="dn-td dn-td--actions app-td-actions">
                    <div className="dn-actions">
                      <Link href={`/delivery-notes/${r.id}`} style={tableActionSecondary()}>
                        View
                      </Link>
                      <a
                        href={`/api/delivery-notes/pdf/${r.id}`}
                        style={tableActionSecondary()}
                        target="_blank"
                        rel="noreferrer"
                      >
                        PDF
                      </a>
                      <a
                        href={`/api/delivery-notes/pdf-dotmatrix/${r.id}`}
                        style={tableActionSecondary()}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Dotmatrix
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
