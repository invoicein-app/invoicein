import { ID_MONTHS } from "./constants";
import type { BcaStatementMetadata, BcaStatementSummary } from "./types";

const REKENING_RE = /NO\.?\s*REKENING\s*:\s*(\d+)/i;
const PERIODE_RE = /PERIODE\s*:\s*([A-Z]+)\s+(\d{4})/i;
const CURRENCY_RE = /MATA UANG\s*:\s*(\w+)/i;

const SUMMARY_RE =
  /SALDO AWAL\s*:\s*([\d,\.]+)\s+MUTASI CR\s*:\s*([\d,\.]+)\s+(\d+)\s+MUTASI DB\s*:\s*([\d,\.]+)\s+(\d+)\s+SALDO AKHIR\s*:\s*([\d,\.]+)/i;

function parseSummaryAmount(raw: string): number | null {
  const normalized = raw.replace(/,/g, "").trim();
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

export function extractMetadata(text: string): BcaStatementMetadata {
  const rekeningMatch = text.match(REKENING_RE);
  const periodeMatch = text.match(PERIODE_RE);
  const currencyMatch = text.match(CURRENCY_RE);

  const monthName = periodeMatch?.[1]?.toUpperCase() ?? null;
  const periodYear = periodeMatch?.[2] ? Number.parseInt(periodeMatch[2], 10) : null;
  const periodMonth = monthName ? ID_MONTHS[monthName] ?? null : null;

  const accountName = extractAccountName(text);

  return {
    accountName,
    accountNumber: rekeningMatch?.[1] ?? null,
    periodLabel: monthName && periodYear ? `${monthName} ${periodYear}` : null,
    periodMonth,
    periodYear,
    currency: currencyMatch?.[1] ?? "IDR",
  };
}

function extractAccountName(text: string): string | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const nameLines: string[] = [];

  for (const line of lines) {
    if (/^NO\.?\s*REKENING/i.test(line)) break;
    if (/^TANGGAL\s+KETERANGAN/i.test(line)) break;
    if (/^CATATAN:/i.test(line)) break;
    if (/^C A T A T A N/i.test(line)) break;
    if (/^REKENING (GIRO|TAHAPAN)/i.test(line)) continue;
    if (/^K C P\s/i.test(line)) continue;
    if (/^\d{2}\/\d{2}\s+/.test(line)) break;
    if (/^INDONESIA$/i.test(line)) continue;
    if (line.length < 2) continue;
    nameLines.push(line);
    if (nameLines.length >= 4) break;
  }

  const joined = nameLines.join(" ").trim();
  return joined || null;
}

export function extractSummary(text: string): BcaStatementSummary {
  const match = text.match(SUMMARY_RE);
  if (!match) {
    return {
      saldoAwal: null,
      totalMutasiCr: null,
      totalMutasiDb: null,
      saldoAkhir: null,
      jumlahTransaksiCr: null,
      jumlahTransaksiDb: null,
    };
  }

  return {
    saldoAwal: parseSummaryAmount(match[1]),
    totalMutasiCr: parseSummaryAmount(match[2]),
    jumlahTransaksiCr: Number.parseInt(match[3], 10),
    totalMutasiDb: parseSummaryAmount(match[4]),
    jumlahTransaksiDb: Number.parseInt(match[5], 10),
    saldoAkhir: parseSummaryAmount(match[6]),
  };
}

export function buildStatementDate(
  ddmm: string,
  periodMonth: number | null,
  periodYear: number | null
): string | null {
  const parts = ddmm.split("/");
  if (parts.length !== 2) return null;
  const day = Number.parseInt(parts[0], 10);
  const txMonth = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(day) || !Number.isFinite(txMonth)) return null;

  let year = periodYear;
  if (year == null) year = new Date().getFullYear();

  if (periodMonth != null && txMonth !== periodMonth) {
    if (txMonth === 12 && periodMonth === 1) year -= 1;
    else if (txMonth === 1 && periodMonth === 12) year += 1;
  }

  const mm = String(txMonth).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
