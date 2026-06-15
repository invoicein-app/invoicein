import { normalizePdfText, splitStatementLines, cleanStatementLines, groupTransactionBlocks } from "./normalize-text";
import { buildStatementDate, extractMetadata, extractSummary } from "./parse-metadata";
import { parseAllTransactions } from "./parse-transactions";
import type { BcaParseResult, BcaParseWarning } from "./types";

function isLikelyBcaStatement(text: string): boolean {
  const upper = text.toUpperCase();
  const hasRekening = /NO\.?\s*REKENING\s*:/i.test(text);
  const hasTableHeader = /TANGGAL\s+KETERANGAN\s+CBG\s+MUTASI\s+SALDO/i.test(text);
  const hasBca = upper.includes("BCA") || /MUTASI CR\s*:/i.test(text);
  return hasRekening && (hasTableHeader || hasBca);
}

export function parseBcaEstatementText(rawText: string): BcaParseResult {
  const text = normalizePdfText(rawText);
  const warnings: BcaParseWarning[] = [];

  if (!text.trim()) {
    return {
      ok: false,
      metadata: extractMetadata(""),
      summary: extractSummary(""),
      transactions: [],
      warnings: [],
      error: "PDF tidak memiliki teks yang dapat dibaca.",
    };
  }

  if (!isLikelyBcaStatement(text)) {
    return {
      ok: false,
      metadata: extractMetadata(text),
      summary: extractSummary(text),
      transactions: [],
      warnings: [],
      error: "Format PDF tidak dikenali sebagai e-Statement BCA.",
    };
  }

  const metadata = extractMetadata(text);
  const summary = extractSummary(text);
  const lines = cleanStatementLines(splitStatementLines(text));
  const blocks = groupTransactionBlocks(lines);

  const buildDate = (ddmm: string) =>
    buildStatementDate(ddmm, metadata.periodMonth, metadata.periodYear);

  const { transactions, warnings: rowWarnings } = parseAllTransactions(blocks, buildDate);
  warnings.push(...rowWarnings);

  if (transactions.length === 0) {
    return {
      ok: false,
      metadata,
      summary,
      transactions: [],
      warnings,
      error: "Tidak ada transaksi yang berhasil diparse dari statement.",
    };
  }

  const crCount = transactions.filter((t) => t.tipeMutasi === "CR").length;
  const dbCount = transactions.filter((t) => t.tipeMutasi === "DB").length;

  if (summary.jumlahTransaksiCr != null && summary.jumlahTransaksiCr !== crCount) {
    warnings.push({
      code: "cr_count_mismatch",
      message: `Jumlah transaksi CR (${crCount}) tidak sama dengan ringkasan PDF (${summary.jumlahTransaksiCr}).`,
    });
  }

  if (summary.jumlahTransaksiDb != null && summary.jumlahTransaksiDb !== dbCount) {
    warnings.push({
      code: "db_count_mismatch",
      message: `Jumlah transaksi DB (${dbCount}) tidak sama dengan ringkasan PDF (${summary.jumlahTransaksiDb}).`,
    });
  }

  const lastSaldo = [...transactions].reverse().find((t) => t.saldo != null)?.saldo ?? null;
  if (summary.saldoAkhir != null && lastSaldo != null && Math.abs(summary.saldoAkhir - lastSaldo) > 0.01) {
    warnings.push({
      code: "saldo_akhir_mismatch",
      message: `Saldo akhir transaksi terakhir (${lastSaldo.toLocaleString("id-ID")}) berbeda dari ringkasan PDF (${summary.saldoAkhir.toLocaleString("id-ID")}).`,
    });
  }

  return finalizeParseResult({
    ok: true,
    metadata,
    summary,
    transactions,
    warnings,
  });
}

export function finalizeParseResult(result: BcaParseResult): BcaParseResult {
  if (result.transactions.length === 0) {
    return { ...result, ok: false, error: result.error || "Tidak ada transaksi." };
  }

  return {
    ...result,
    ok: !result.error,
  };
}
