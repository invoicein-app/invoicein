"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  tableActionDisabled,
  tableActionPrimary,
  tableActionSecondary,
} from "../components/app-action-buttons";
import TableEmptyState from "../components/table-empty-state";
import type { QuotationRow } from "./quotations-list-client";

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
  if (s === "accepted") return "ACCEPTED";
  if (s === "sent") return "SENT";
  if (s === "rejected") return "REJECTED";
  if (s === "cancelled") return "CANCELLED";
  return "DRAFT";
}

function badgeStyle(status: string | null | undefined) {
  const s = String(status || "draft").toLowerCase();
  if (s === "accepted") return { bg: "#dcfce7", border: "#86efac", color: "#14532d" };
  if (s === "sent") return { bg: "#e0f2fe", border: "#7dd3fc", color: "#0c4a6e" };
  if (s === "rejected") return { bg: "#fee2e2", border: "#fca5a5", color: "#7f1d1d" };
  if (s === "cancelled") return { bg: "#f1f5f9", border: "#cbd5e1", color: "#334155" };
  return { bg: "#f3f4f6", border: "#d1d5db", color: "#374151" };
}

type Props = {
  rows: QuotationRow[];
  loading?: boolean;
  invoiceNoMap: Record<string, string>;
  convertingId: string;
  onConvert: (id: string) => void;
};

export default function QuotationsListTable({
  rows,
  loading,
  invoiceNoMap,
  convertingId,
  onConvert,
}: Props) {
  const router = useRouter();

  return (
    <div className="quotations-table-scroll">
      <table className="quotations-list-table app-table--quotations">
        <thead>
          <tr>
            <th className="qt-th qt-th--number">Nomor Quotation</th>
            <th className="qt-th qt-th--status">Status</th>
            <th className="qt-th qt-th--customer">Customer</th>
            <th className="qt-th qt-th--total">Total</th>
            <th className="qt-th qt-th--actions">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className="qt-td qt-td--loading">
                Memuat data…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <TableEmptyState colSpan={5} message="Belum ada quotation." />
          ) : (
            rows.map((r) => {
              const st = String(r.status || "draft");
              const isBusy = convertingId === r.id;
              const hasInvoice = !!r.invoice_id;
              const locked = !!r.is_locked;
              const canConvert = !hasInvoice && !locked;
              const badge = badgeStyle(st);

              const invNo = r.invoice_id ? invoiceNoMap[String(r.invoice_id)] : "";
              const invLabel = invNo ? invNo : r.invoice_id ? `${String(r.invoice_id).slice(0, 8)}…` : "";

              return (
                <tr key={r.id}>
                  <td className="qt-td qt-td--number">
                    <Link href={`/quotations/${r.id}`} className="qt-number-link">
                      {r.quotation_number || "-"}
                    </Link>
                    <div className="qt-number-meta">Tanggal: {formatTanggalIndo(r.quotation_date)}</div>
                  </td>

                  <td className="qt-td qt-td--status">
                    <div className="qt-status-wrap">
                      <span
                        className="qt-status-badge"
                        style={{
                          background: badge.bg,
                          borderColor: badge.border,
                          color: badge.color,
                        }}
                      >
                        {statusLabel(st)}
                      </span>
                      {locked ? <span className="qt-locked-pill">locked</span> : null}
                    </div>
                  </td>

                  <td className="qt-td qt-td--customer">
                    <div className="qt-customer-name">{r.customer_name || "-"}</div>
                    {hasInvoice ? (
                      <div className="qt-invoice-ref">
                        Invoice:{" "}
                        <Link href={`/invoice/${r.invoice_id}`} className="qt-invoice-link">
                          {invLabel}
                        </Link>
                      </div>
                    ) : null}
                  </td>

                  <td className="qt-td qt-td--total">
                    <span className="qt-total">Rp {fmtMoney(r.total)}</span>
                  </td>

                  <td className="qt-td qt-td--actions app-td-actions">
                    <div className="qt-actions">
                      <button
                        type="button"
                        onClick={() => router.push(`/quotations/${r.id}`)}
                        style={tableActionSecondary()}
                      >
                        Detail
                      </button>
                      <a
                        href={`/api/quotations/pdf/${r.id}?download=1`}
                        target="_blank"
                        rel="noreferrer"
                        style={tableActionSecondary()}
                        title="Download Quotation (PDF)"
                      >
                        Download
                      </a>
                      {hasInvoice ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/invoice/${r.invoice_id}`)}
                          style={tableActionPrimary()}
                        >
                          Buka Invoice
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onConvert(r.id)}
                          style={canConvert && !isBusy ? tableActionPrimary() : tableActionDisabled()}
                          disabled={!canConvert || isBusy}
                          title={locked ? "Quotation locked, tidak bisa convert" : "Convert jadi invoice"}
                        >
                          {isBusy ? "Converting..." : locked ? "Locked" : "Convert → Invoice"}
                        </button>
                      )}
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
