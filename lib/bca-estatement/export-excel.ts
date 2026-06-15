import ExcelJS from "exceljs";
import type { BcaParseResult, BcaTransaction } from "./types";

const HEADER_FILL = "FFEEF2F6";
const HEADER_FONT = "FF334155";
const BORDER_COLOR = "FFD0D5DD";
const MONEY_NUM_FMT = "#,##0.00";
const DATE_NUM_FMT = "yyyy-mm-dd";
const HEADER_ROW_HEIGHT = 22;
const DATA_ROW_HEIGHT = 18;

type TxCol = {
  header: string;
  key: keyof BcaTransaction | "tanggalExcel";
  kind: "text" | "date" | "money";
};

const TX_COLUMNS: TxCol[] = [
  { header: "Tanggal", key: "tanggalExcel", kind: "date" },
  { header: "Tipe Mutasi", key: "tipeMutasi", kind: "text" },
  { header: "Nominal", key: "nominal", kind: "money" },
  { header: "Saldo", key: "saldo", kind: "money" },
  { header: "Keterangan Utama", key: "keteranganUtama", kind: "text" },
  { header: "Keterangan Detail", key: "keteranganDetail", kind: "text" },
  { header: "Nama Lawan Transaksi", key: "namaLawanTransaksi", kind: "text" },
  { header: "Channel / Jenis Transaksi", key: "channel", kind: "text" },
  { header: "CBG", key: "cbg", kind: "text" },
  { header: "No Referensi", key: "noReferensi", kind: "text" },
  { header: "Raw Text", key: "rawText", kind: "text" },
];

const COLUMN_WIDTH_LIMITS: Record<string, { min: number; max: number }> = {
  tanggalExcel: { min: 11, max: 12 },
  tipeMutasi: { min: 10, max: 12 },
  nominal: { min: 14, max: 18 },
  saldo: { min: 14, max: 20 },
  keteranganUtama: { min: 22, max: 48 },
  keteranganDetail: { min: 20, max: 52 },
  namaLawanTransaksi: { min: 16, max: 36 },
  channel: { min: 18, max: 28 },
  cbg: { min: 6, max: 8 },
  noReferensi: { min: 14, max: 28 },
  rawText: { min: 12, max: 16 },
};

function thinBorder(): Partial<ExcelJS.Borders> {
  const edge: Partial<ExcelJS.Border> = { style: "thin", color: { argb: BORDER_COLOR } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function parseExcelDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return new Date(`${iso}T00:00:00`);
}

function longestLineLength(value: unknown): number {
  if (value == null) return 0;
  if (value instanceof Date) return 10;
  if (typeof value === "number") {
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",").length + 2;
  }
  const text = String(value);
  if (!text) return 0;
  return Math.max(...text.split(/\r?\n/).map((line) => line.length), 0);
}

function fitColumnWidth(header: string, key: string, sheet: ExcelJS.Worksheet, colIndex: number): number {
  const limits = COLUMN_WIDTH_LIMITS[key] ?? { min: 10, max: 36 };
  let maxLen = header.length;

  sheet.getColumn(colIndex).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
    if (rowNumber === 1) return;
    maxLen = Math.max(maxLen, longestLineLength(cell.value));
  });

  return Math.min(limits.max, Math.max(limits.min, maxLen + 1));
}

function mapTxRow(tx: BcaTransaction): Record<string, string | number | Date | null> {
  return {
    tanggalExcel: parseExcelDate(tx.tanggalDate),
    tipeMutasi: tx.tipeMutasi,
    nominal: tx.nominal,
    saldo: tx.saldo,
    keteranganUtama: tx.keteranganUtama,
    keteranganDetail: tx.keteranganDetail,
    namaLawanTransaksi: tx.namaLawanTransaksi || "",
    channel: tx.channel || "",
    cbg: tx.cbg || "",
    noReferensi: tx.noReferensi || "",
    rawText: tx.rawText,
  };
}

function applySheetFormatting(
  sheet: ExcelJS.Worksheet,
  cols: TxCol[],
  dataRowCount: number
) {
  const totalRows = Math.max(1, dataRowCount + 1);
  const borders = thinBorder();

  for (let r = 1; r <= totalRows; r++) {
    const row = sheet.getRow(r);
    row.height = r === 1 ? HEADER_ROW_HEIGHT : DATA_ROW_HEIGHT;

    cols.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
      cell.border = borders;

      if (r === 1) {
        cell.font = { bold: true, size: 11, color: { argb: HEADER_FONT } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
        return;
      }

      if (col.kind === "money") {
        cell.numFmt = MONEY_NUM_FMT;
        cell.alignment = { vertical: "middle", horizontal: "right", wrapText: false };
        return;
      }

      if (col.kind === "date") {
        cell.numFmt = DATE_NUM_FMT;
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
        return;
      }

      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
    });
  }

  cols.forEach((col, idx) => {
    const column = sheet.getColumn(idx + 1);
    column.width = fitColumnWidth(col.header, col.key, sheet, idx + 1);
    if (col.key === "rawText") {
      column.hidden = true;
    }
  });

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: totalRows, column: cols.length } };
  sheet.views = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];
}

function addRingkasanSheet(workbook: ExcelJS.Workbook, result: BcaParseResult) {
  const sheet = workbook.addWorksheet("Ringkasan");
  const { metadata, summary, transactions } = result;

  const crCount = transactions.filter((t) => t.tipeMutasi === "CR").length;
  const dbCount = transactions.filter((t) => t.tipeMutasi === "DB").length;

  const rows: [string, string | number | null][] = [
    ["Nama Rekening", metadata.accountName],
    ["No Rekening", metadata.accountNumber],
    ["Periode", metadata.periodLabel],
    ["Mata Uang", metadata.currency],
    ["Saldo Awal", summary.saldoAwal],
    ["Total Mutasi CR", summary.totalMutasiCr],
    ["Total Mutasi DB", summary.totalMutasiDb],
    ["Saldo Akhir", summary.saldoAkhir],
    ["Jumlah Transaksi CR (PDF)", summary.jumlahTransaksiCr],
    ["Jumlah Transaksi DB (PDF)", summary.jumlahTransaksiDb],
    ["Jumlah Transaksi Terparse CR", crCount],
    ["Jumlah Transaksi Terparse DB", dbCount],
    ["Jumlah Transaksi Terparse", transactions.length],
  ];

  sheet.addRow(["Metrik", "Nilai"]);
  for (const [label, value] of rows) {
    sheet.addRow([label, value ?? ""]);
  }

  const borders = thinBorder();
  let labelWidth = "Metrik".length;
  let valueWidth = "Nilai".length;

  for (const [label, value] of rows) {
    labelWidth = Math.max(labelWidth, label.length);
    valueWidth = Math.max(valueWidth, longestLineLength(value));
  }

  sheet.getColumn(1).width = Math.min(40, labelWidth + 2);
  sheet.getColumn(2).width = Math.min(28, Math.max(18, valueWidth + 2));

  for (let r = 1; r <= rows.length + 1; r++) {
    const row = sheet.getRow(r);
    row.height = r === 1 ? HEADER_ROW_HEIGHT : DATA_ROW_HEIGHT;

    for (let c = 1; c <= 2; c++) {
      const cell = row.getCell(c);
      cell.border = borders;
      if (r === 1) {
        cell.font = { bold: true, size: 11, color: { argb: HEADER_FONT } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
      } else if (c === 2 && typeof cell.value === "number") {
        cell.numFmt = MONEY_NUM_FMT;
        cell.alignment = { vertical: "middle", horizontal: "right", wrapText: false };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
      }
    }
  }

  sheet.views = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];
}

export async function buildBcaEstatementExportBuffer(result: BcaParseResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "InvoiceKu";
  workbook.created = new Date();

  const txSheet = workbook.addWorksheet("Transaksi");
  txSheet.addRow(TX_COLUMNS.map((c) => c.header));

  for (const tx of result.transactions) {
    const data = mapTxRow(tx);
    txSheet.addRow(TX_COLUMNS.map((c) => data[c.key] ?? null));
  }

  applySheetFormatting(txSheet, TX_COLUMNS, result.transactions.length);
  addRingkasanSheet(workbook, result);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export { TX_COLUMNS };
