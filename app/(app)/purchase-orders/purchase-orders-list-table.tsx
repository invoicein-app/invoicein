"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  tableActionPrimary,
  tableActionSecondary,
} from "../components/app-action-buttons";
import TableEmptyState from "../components/table-empty-state";

export type PurchaseOrderRow = {
  id: string;
  po_number: string | null;
  po_date: string | null;
  vendor_name: string | null;
  total: number | null;
  status: string | null;
};

function formatTanggalIndo(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMoney(n: number | null | undefined) {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function statusLabel(status: string | null | undefined) {
  const s = String(status || "draft").toLowerCase();
  if (s === "draft") return "DRAFT";
  if (s === "sent") return "SENT";
  if (s === "partially_received") return "PARTIAL";
  if (s === "received") return "RECEIVED";
  if (s === "cancelled") return "CANCELLED";
  return s ? s.toUpperCase() : "DRAFT";
}

function canReceive(status: string) {
  const s = String(status || "").toLowerCase();
  return s === "sent" || s === "partially_received";
}

function badgeStyle(status: string | null | undefined) {
  const s = String(status || "draft").toLowerCase();
  if (s === "sent") return { bg: "#e0f2fe", border: "#7dd3fc", color: "#0c4a6e" };
  if (s === "partially_received") return { bg: "#fffbeb", border: "#fcd34d", color: "#92400e" };
  if (s === "received") return { bg: "#dcfce7", border: "#86efac", color: "#14532d" };
  if (s === "cancelled") return { bg: "#fee2e2", border: "#fca5a5", color: "#7f1d1d" };
  return { bg: "#f3f4f6", border: "#d1d5db", color: "#374151" };
}

type Props = {
  rows: PurchaseOrderRow[];
  loading?: boolean;
};

export default function PurchaseOrdersListTable({ rows, loading }: Props) {
  const router = useRouter();

  return (
    <div className="purchase-orders-table-scroll">
      <table className="purchase-orders-list-table app-table--purchase-orders">
        <thead>
          <tr>
            <th className="po-th po-th--number">Nomor PO</th>
            <th className="po-th po-th--status">Status</th>
            <th className="po-th po-th--vendor">Vendor</th>
            <th className="po-th po-th--total">Total</th>
            <th className="po-th po-th--actions">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className="po-td po-td--loading">
                Memuat data…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <TableEmptyState colSpan={5} message="Belum ada purchase order." />
          ) : (
            rows.map((r) => {
              const st = String(r.status || "draft");
              const badge = badgeStyle(st);

              return (
                <tr key={r.id}>
                  <td className="po-td po-td--number">
                    <Link href={`/purchase-orders/${r.id}`} className="po-number-link">
                      {r.po_number || "-"}
                    </Link>
                    <div className="po-number-meta">Tanggal: {formatTanggalIndo(r.po_date)}</div>
                  </td>

                  <td className="po-td po-td--status">
                    <span
                      className="po-status-badge"
                      style={{
                        background: badge.bg,
                        borderColor: badge.border,
                        color: badge.color,
                      }}
                    >
                      {statusLabel(st)}
                    </span>
                  </td>

                  <td className="po-td po-td--vendor">{r.vendor_name || "-"}</td>

                  <td className="po-td po-td--total">
                    <span className="po-total">Rp {fmtMoney(r.total)}</span>
                  </td>

                  <td className="po-td po-td--actions app-td-actions">
                    <div className="po-actions">
                      <button
                        type="button"
                        onClick={() => router.push(`/purchase-orders/${r.id}`)}
                        style={tableActionSecondary()}
                      >
                        Detail
                      </button>
                      {canReceive(st) ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/purchase-orders/${r.id}/receive`)}
                          style={tableActionPrimary()}
                        >
                          Terima Barang
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => window.open(`/api/purchase-orders/pdf/${r.id}`, "_blank")}
                        style={tableActionSecondary()}
                        title="Preview PDF"
                      >
                        PDF
                      </button>
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
