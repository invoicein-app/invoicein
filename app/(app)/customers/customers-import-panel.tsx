"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  mapPaperIdRow,
  type MappedCustomerDraft,
  type PaperIdRawRow,
} from "@/lib/paper-id-customer-import";
import { formPrimaryButton, tableActionSecondary } from "../components/app-action-buttons";
import FormSubmitButton from "../components/form-submit-button";
import { useSubmitGuard } from "../components/use-submit-guard";
import { ul } from "../components/unified-list-table";

type PreviewRow = {
  excelRow: number;
  status: "ready" | "skip";
  reason?: string;
  name?: string;
  data?: MappedCustomerDraft;
};

type ImportApiResponse = {
  ok?: boolean;
  error?: string;
  duplicate_rule?: string;
  summary?: {
    totalRows: number;
    imported: number;
    skipped: number;
    failed: number;
    details: { excelRow: number; status: string; name?: string; reason?: string }[];
  };
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export default function CustomersImportPanel({ open, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const { tryBegin, end, isBlocked } = useSubmitGuard(setImporting);
  const [result, setResult] = useState<ImportApiResponse | null>(null);

  const readyCount = useMemo(
    () => preview.filter((p) => p.status === "ready").length,
    [preview]
  );
  const skipCount = useMemo(
    () => preview.filter((p) => p.status === "skip").length,
    [preview]
  );

  function reset() {
    setFile(null);
    setPreview([]);
    setParseError("");
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileChange(f: File | null) {
    setFile(f);
    setResult(null);
    setParseError("");
    setPreview([]);

    if (!f) return;

    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      setParseError("Pilih file .xlsx atau .xls (export Paper.id).");
      return;
    }

    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: false });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        setParseError("Excel tidak memiliki sheet.");
        return;
      }
      const rawRows = XLSX.utils.sheet_to_json<PaperIdRawRow>(wb.Sheets[sheetName], {
        defval: "",
      });

      const rows: PreviewRow[] = rawRows.map((row, i) => {
        const excelRow = i + 2;
        const mapped = mapPaperIdRow(row, excelRow);
        if (!mapped.ok) {
          return {
            excelRow,
            status: "skip" as const,
            reason: mapped.reason,
            name: mapped.name,
          };
        }
        return { excelRow, status: "ready" as const, data: mapped.data };
      });

      setPreview(rows);
      if (rows.length === 0) {
        setParseError("Tidak ada baris data di file.");
      }
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : "Gagal membaca file Excel.");
    }
  }

  async function runImport() {
    if (!file) return;
    if (isBlocked()) return;
    setParseError("");
    setResult(null);
    if (!tryBegin()) return;

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/customers/import", {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const json = (await res.json().catch(() => ({}))) as ImportApiResponse;
      if (!res.ok) {
        setParseError(json.error || `Import gagal (${res.status})`);
        return;
      }

      setResult(json);
      onImported();
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : "Import gagal.");
    } finally {
      end();
    }
  }

  if (!open) return null;

  return (
    <div style={backdrop()}>
      <div style={panel()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Import Customer (Paper.id)</h2>
            <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
              Upload export mitra dari Paper.id (.xlsx). Kolom: Nama, Telpon Seluler / Telp, dan alamat
              digabung otomatis. Hanya tipe <strong>Client</strong> dan <strong>Both</strong>.
            </p>
          </div>
          <button type="button" onClick={handleClose} disabled={importing} style={tableActionSecondary()}>
            Tutup
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            File Excel
          </label>
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            style={{ width: "100%", fontSize: 14 }}
          />
          {file ? (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b" }}>
              {file.name} ({Math.round(file.size / 1024)} KB)
            </p>
          ) : null}
        </div>

        {parseError ? (
          <div style={alert("error")}>
            <strong>Error:</strong> {parseError}
          </div>
        ) : null}

        {preview.length > 0 && !result ? (
          <>
            <div style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14 }}>
              <span>
                <strong>{preview.length}</strong> baris dibaca
              </span>
              <span style={{ color: "#15803d" }}>
                <strong>{readyCount}</strong> siap import
              </span>
              <span style={{ color: "#b45309" }}>
                <strong>{skipCount}</strong> akan dilewati (preview)
              </span>
            </div>

            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#94a3b8" }}>
              Duplikat di database / di file dicek saat import di server.
            </p>

            <div className={ul.scroll} style={{ marginTop: 16, maxHeight: 320 }}>
              <table className={`${ul.table} app-table--customers-import-preview`} style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th className={ul.th}>Baris</th>
                    <th className={ul.th}>Nama</th>
                    <th className={ul.th}>Telepon</th>
                    <th className={ul.th}>Alamat</th>
                    <th className={ul.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 25).map((row) => (
                    <tr key={row.excelRow}>
                      <td className={ul.td}>{row.excelRow}</td>
                      <td className={ul.tdTop}>
                        <span className={ul.primaryText}>
                          {row.data?.name || row.reason?.slice(0, 40) || "—"}
                        </span>
                      </td>
                      <td className={ul.td}>{row.data?.phone || "—"}</td>
                      <td className={ul.td}>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{row.data?.address || "—"}</span>
                      </td>
                      <td className={ul.td}>
                        {row.status === "ready" ? (
                          <span className={ul.tag} style={{ background: "#ecfdf5", color: "#065f46", borderColor: "#86efac" }}>
                            Siap
                          </span>
                        ) : (
                          <span title={row.reason} className={ul.tag}>
                            Lewati
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.length > 25 ? (
              <p style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
                Menampilkan 25 baris pertama dari {preview.length}.
              </p>
            ) : null}

            <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={reset} style={tableActionSecondary()} disabled={importing}>
                Reset
              </button>
              <FormSubmitButton
                busy={importing}
                busyLabel="Mengimport…"
                disabled={readyCount === 0}
                onClick={runImport}
              >
                {`Import ${readyCount} customer`}
              </FormSubmitButton>
            </div>
          </>
        ) : null}

        {result?.summary ? (
          <div style={{ marginTop: 20 }}>
            <div style={alert("success")}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Import selesai</div>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                <li>
                  <strong>{result.summary.imported}</strong> berhasil diimport
                </li>
                <li>
                  <strong>{result.summary.skipped}</strong> dilewati
                </li>
                <li>
                  <strong>{result.summary.failed}</strong> gagal
                </li>
                <li>
                  Total baris file: <strong>{result.summary.totalRows}</strong>
                </li>
              </ul>
              {result.duplicate_rule ? (
                <p style={{ margin: "12px 0 0", fontSize: 12, color: "#166534" }}>{result.duplicate_rule}</p>
              ) : null}
            </div>

            {result.summary.details.length > 0 ? (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                  Detail ({result.summary.details.length})
                </summary>
                <div
                  style={{
                    marginTop: 8,
                    maxHeight: 200,
                    overflow: "auto",
                    fontSize: 12,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  {result.summary.details.slice(0, 100).map((d, i) => (
                    <div key={`${d.excelRow}-${i}`} style={{ marginBottom: 6 }}>
                      {d.excelRow > 0 ? `Baris ${d.excelRow}: ` : ""}
                      <strong>{d.status}</strong>
                      {d.name ? ` — ${d.name}` : ""}
                      {d.reason ? ` (${d.reason})` : ""}
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={handleClose} style={formPrimaryButton()}>
                Selesai
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function backdrop(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    zIndex: 60,
  };
}

function panel(): React.CSSProperties {
  return {
    width: "min(920px, 100%)",
    maxHeight: "min(90vh, 900px)",
    overflow: "auto",
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    padding: 24,
    boxShadow: "0 24px 48px rgba(0,0,0,0.12)",
  };
}

function alert(kind: "error" | "success"): React.CSSProperties {
  if (kind === "error") {
    return {
      marginTop: 16,
      padding: 12,
      borderRadius: 10,
      background: "#fef2f2",
      border: "1px solid #fecaca",
      color: "#991b1b",
      fontSize: 14,
    };
  }
  return {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#14532d",
    fontSize: 14,
  };
}
