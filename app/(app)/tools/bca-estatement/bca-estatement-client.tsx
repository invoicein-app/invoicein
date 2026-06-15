"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { formPrimaryButton, tableActionSecondary } from "../../components/app-action-buttons";
import FormSubmitButton from "../../components/form-submit-button";
import { useSubmitGuard } from "../../components/use-submit-guard";
import { APP_BORDER, APP_TEAL } from "../../components/app-ui-tokens";
import type { BcaParseResult, BcaTransaction } from "@/lib/bca-estatement/types";

type ParseApiResponse = BcaParseResult & {
  stats?: { total: number; cr: number; db: number };
};

function rupiah(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatTanggal(tx: BcaTransaction): string {
  return tx.tanggalDate || tx.tanggal;
}

export default function BcaEstatementClient() {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseApiResponse | null>(null);
  const [parseError, setParseError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { tryBegin: tryParse, end: endParse, isBlocked: isParseBlocked } = useSubmitGuard(setParsing);
  const { tryBegin: tryExport, end: endExport, isBlocked: isExportBlocked } = useSubmitGuard(setExporting);

  const previewRows = useMemo(() => parseResult?.transactions.slice(0, 50) ?? [], [parseResult]);
  const hasWarnings = (parseResult?.warnings?.length ?? 0) > 0;

  function reset() {
    setFile(null);
    setParseResult(null);
    setParseError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(f: File | null) {
    setFile(f);
    setParseResult(null);
    setParseError("");

    if (!f) return;
    if (!/\.pdf$/i.test(f.name)) {
      setParseError("Pilih file PDF e-Statement BCA.");
    }
  }

  function pickPdfFile() {
    fileInputRef.current?.click();
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (!dropped) return;
    handleFileChange(dropped);
  }

  async function runParse() {
    if (!file || isParseBlocked()) return;
    if (!tryParse()) return;

    setParseError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/tools/bca-estatement/parse", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as ParseApiResponse & { error?: string };

      if (!res.ok) {
        setParseError(data.error || "Gagal memparse PDF.");
        setParseResult(data.transactions?.length ? data : null);
        return;
      }

      setParseResult(data);
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : "Gagal memparse PDF.");
    } finally {
      endParse();
    }
  }

  async function runExport() {
    if (!parseResult?.transactions.length || isExportBlocked()) return;
    if (!tryExport()) return;

    try {
      const res = await fetch("/api/tools/bca-estatement/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          metadata: parseResult.metadata,
          summary: parseResult.summary,
          transactions: parseResult.transactions,
          warnings: parseResult.warnings,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setParseError((data as { error?: string }).error || "Gagal export Excel.");
        return;
      }

      const blob = await res.blob();
      const account = parseResult.metadata.accountNumber || "bca";
      const period = (parseResult.metadata.periodLabel || "statement").replace(/\s+/g, "-").toLowerCase();
      const filename = `bca-estatement-${account}-${period}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : "Gagal export Excel.");
    } finally {
      endExport();
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section
        style={{
          background: "#fff",
          border: `1px solid ${APP_BORDER}`,
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#1e293b" }}>1. Upload PDF</h2>
        <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
          Unggah file e-Statement BCA (.pdf). Sistem mengekstrak teks dari PDF (tanpa OCR) lalu
          memparse baris transaksi multi-baris.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          style={{ display: "none" }}
        />

        <div
          role="button"
          tabIndex={0}
          onClick={pickPdfFile}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pickPdfFile();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            marginBottom: 14,
            padding: "28px 20px",
            borderRadius: 12,
            border: `2px dashed ${isDragging ? APP_TEAL : "#CBD5E1"}`,
            background: isDragging ? "#E6F4F1" : "#F8FAFC",
            textAlign: "center",
            cursor: "pointer",
            transition: "border-color 0.15s ease, background 0.15s ease",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              margin: "0 auto 12px",
              borderRadius: 10,
              background: isDragging ? "#D1EDE8" : "#EEF2F6",
              display: "grid",
              placeItems: "center",
              color: APP_TEAL,
              fontSize: 22,
              fontWeight: 700,
            }}
            aria-hidden
          >
            PDF
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
            {isDragging ? "Lepaskan file di sini" : "Drag and drop file PDF disini"}
          </div>
          <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
            atau <span style={{ color: APP_TEAL, fontWeight: 700 }}>klik untuk memilih file</span>
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 8 }}>Format: .pdf e-Statement BCA</div>
        </div>

        {file ? (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${APP_BORDER}`,
              background: "#fff",
              fontSize: 13,
              color: "#334155",
            }}
          >
            <strong>File dipilih:</strong> {file.name}{" "}
            <span style={{ color: "#94A3B8" }}>({Math.round(file.size / 1024)} KB)</span>
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <FormSubmitButton
            type="button"
            onClick={runParse}
            disabled={!file || parsing}
            style={formPrimaryButton()}
          >
            {parsing ? "Memproses…" : "Parse PDF"}
          </FormSubmitButton>
          {file || parseResult ? (
            <button type="button" onClick={reset} style={tableActionSecondary()}>
              Reset
            </button>
          ) : null}
        </div>

        {parseError ? (
          <div
            role="alert"
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#FEF2F2",
              color: "#B91C1C",
              fontSize: 14,
            }}
          >
            {parseError}
          </div>
        ) : null}
      </section>

      {parseResult ? (
        <>
          <section
            style={{
              background: "#fff",
              border: `1px solid ${APP_BORDER}`,
              borderRadius: 12,
              padding: 20,
            }}
          >
            <h2 style={{ margin: "0 0 12px", fontSize: 18, color: "#1e293b" }}>2. Ringkasan</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {[
                ["Rekening", parseResult.metadata.accountNumber || "-"],
                ["Nama", parseResult.metadata.accountName || "-"],
                ["Periode", parseResult.metadata.periodLabel || "-"],
                ["Transaksi", String(parseResult.stats?.total ?? parseResult.transactions.length)],
                ["CR / DB", `${parseResult.stats?.cr ?? 0} / ${parseResult.stats?.db ?? 0}`],
                ["Saldo Awal", rupiah(parseResult.summary.saldoAwal)],
                ["Saldo Akhir", rupiah(parseResult.summary.saldoAkhir)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    border: `1px solid ${APP_BORDER}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    background: "#F8FAFC",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>

            {hasWarnings ? (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  color: "#92400E",
                  fontSize: 14,
                }}
              >
                <strong>Peringatan parse:</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {parseResult.warnings.map((w) => (
                    <li key={`${w.code}-${w.message}`}>{w.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div style={{ marginTop: 16 }}>
              <FormSubmitButton
                type="button"
                onClick={runExport}
                disabled={exporting || !parseResult.transactions.length}
                style={formPrimaryButton()}
              >
                {exporting ? "Mengekspor…" : "Export Excel (.xlsx)"}
              </FormSubmitButton>
            </div>
          </section>

          <section
            style={{
              background: "#fff",
              border: `1px solid ${APP_BORDER}`,
              borderRadius: 12,
              padding: 20,
              overflow: "hidden",
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#1e293b" }}>3. Preview Transaksi</h2>
            <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13 }}>
              Menampilkan {previewRows.length} dari {parseResult.transactions.length} baris. Data preview
              sama dengan sheet <strong>Transaksi</strong> di Excel.
            </p>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#EEF2F6", textAlign: "left" }}>
                    {[
                      "Tanggal",
                      "Tipe",
                      "Nominal",
                      "Saldo",
                      "Keterangan Utama",
                      "Channel",
                      "CBG",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 8px",
                          borderBottom: `1px solid ${APP_BORDER}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((tx, idx) => (
                    <tr key={`${tx.tanggal}-${idx}-${tx.nominal}`}>
                      <td style={{ padding: "8px", borderBottom: `1px solid ${APP_BORDER}` }}>
                        {formatTanggal(tx)}
                      </td>
                      <td style={{ padding: "8px", borderBottom: `1px solid ${APP_BORDER}` }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: tx.tipeMutasi === "CR" ? "#047857" : "#B45309",
                          }}
                        >
                          {tx.tipeMutasi}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          borderBottom: `1px solid ${APP_BORDER}`,
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {rupiah(tx.nominal)}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          borderBottom: `1px solid ${APP_BORDER}`,
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {rupiah(tx.saldo)}
                      </td>
                      <td style={{ padding: "8px", borderBottom: `1px solid ${APP_BORDER}`, minWidth: 220 }}>
                        {tx.keteranganUtama}
                      </td>
                      <td style={{ padding: "8px", borderBottom: `1px solid ${APP_BORDER}` }}>
                        {tx.channel || "-"}
                      </td>
                      <td style={{ padding: "8px", borderBottom: `1px solid ${APP_BORDER}` }}>
                        {tx.cbg || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {!parseResult && !parseError ? (
        <p style={{ color: "#94A3B8", fontSize: 13 }}>
          Tip: pastikan PDF e-Statement asli dari BCA (bukan scan/foto). File password-protected tidak
          didukung.
        </p>
      ) : null}
    </div>
  );
}
