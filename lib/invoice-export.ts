import ExcelJS from "exceljs";
import {
  formatRawInvoiceStatus,
  type InvoiceListComputedRow,
  type InvoiceListFilters,
} from "@/lib/invoice-list-utils";

type ColKind = "text" | "date" | "money";

type ExportColumnDef = {
  header: string;
  key: string;
  kind: ColKind;
};

const HEADER_FILL = "FFEEF2F6";
const HEADER_FONT = "FF334155";
const BORDER_COLOR = "FFD0D5DD";
const MONEY_NUM_FMT = "#,##0";
const DATE_NUM_FMT = "yyyy-mm-dd";

const BASE_EXPORT_COLUMNS: ExportColumnDef[] = [
  { header: "Nomor Invoice", key: "nomorInvoice", kind: "text" },
  { header: "Tanggal", key: "tanggal", kind: "date" },
  { header: "Customer", key: "customer", kind: "text" },
  { header: "Status Invoice", key: "statusInvoice", kind: "text" },
  { header: "Status Pembayaran", key: "statusPembayaran", kind: "text" },
  { header: "Jatuh Tempo", key: "jatuhTempo", kind: "date" },
  { header: "Subtotal", key: "subtotal", kind: "money" },
  { header: "Diskon", key: "diskon", kind: "money" },
  { header: "Pajak", key: "pajak", kind: "money" },
  { header: "Total Invoice", key: "totalInvoice", kind: "money" },
  { header: "Sudah Dibayar", key: "sudahDibayar", kind: "money" },
  { header: "Sisa", key: "sisa", kind: "money" },
  { header: "Catatan", key: "catatan", kind: "text" },
];

const BOOKKEEPING_COLUMN: ExportColumnDef = {
  header: "Status Pencatatan",
  key: "statusPencatatan",
  kind: "text",
};

function customerName(inv: InvoiceListComputedRow): string {
  return inv.customers?.name || inv.customer_name || "-";
}

function parseExcelDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00`);
}

function formatBookkeepingStatus(recorded: boolean | null | undefined): string {
  return recorded ? "Sudah dicatat" : "Belum dicatat";
}

function getColumnDefs(showBookkeeping: boolean): ExportColumnDef[] {
  if (showBookkeeping) return [...BASE_EXPORT_COLUMNS, BOOKKEEPING_COLUMN];
  return BASE_EXPORT_COLUMNS;
}

function mapInvoiceToRow(
  inv: InvoiceListComputedRow,
  showBookkeeping: boolean
): Record<string, string | number | Date | null> {
  const row: Record<string, string | number | Date | null> = {
    nomorInvoice: inv.invoice_number || "",
    tanggal: parseExcelDate(inv.invoice_date),
    customer: customerName(inv),
    statusInvoice: formatRawInvoiceStatus(inv.status),
    statusPembayaran: inv.payStatus,
    jatuhTempo: parseExcelDate(inv.due_date),
    subtotal: inv.subtotal,
    diskon: inv.discount,
    pajak: inv.tax,
    totalInvoice: inv.grandTotal,
    sudahDibayar: inv.paid,
    sisa: inv.remaining,
    catatan: inv.note?.trim() || "",
  };

  if (showBookkeeping) {
    row.statusPencatatan = formatBookkeepingStatus(inv.bookkeeping_recorded);
  }

  return row;
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const edge: Partial<ExcelJS.Border> = {
    style: "thin",
    color: { argb: BORDER_COLOR },
  };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function applyInvoiceSheetFormatting(
  sheet: ExcelJS.Worksheet,
  cols: ExportColumnDef[],
  dataRowCount: number
) {
  const totalRows = Math.max(1, dataRowCount + 1);
  const borders = thinBorder();

  for (let r = 1; r <= totalRows; r++) {
    const row = sheet.getRow(r);
    row.height = r === 1 ? 22 : 18;

    cols.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
      cell.border = borders;

      if (r === 1) {
        cell.font = { bold: true, size: 11, color: { argb: HEADER_FONT } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: HEADER_FILL },
        };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        return;
      }

      if (col.kind === "money") {
        cell.numFmt = MONEY_NUM_FMT;
        cell.alignment = { vertical: "middle", horizontal: "right" };
        return;
      }

      if (col.kind === "date") {
        cell.numFmt = DATE_NUM_FMT;
        cell.alignment = { vertical: "middle", horizontal: "left" };
        return;
      }

      cell.alignment = {
        vertical: "middle",
        horizontal: "left",
        wrapText: col.key === "catatan",
      };
    });
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: totalRows, column: cols.length },
  };

  sheet.views = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];

  cols.forEach((col, idx) => {
    const column = sheet.getColumn(idx + 1);
    let maxLen = col.header.length;

    column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber === 1) return;
      let len = 10;
      if (cell.value instanceof Date) len = 10;
      else if (typeof cell.value === "number") len = String(Math.round(cell.value)).length + 2;
      else if (cell.value != null) len = String(cell.value).length;
      maxLen = Math.max(maxLen, len);
    });

    const cap = col.key === "catatan" ? 56 : 40;
    column.width = Math.min(cap, Math.max(10, maxLen + 2));
  });
}

export function exportColumnOrder(showBookkeeping: boolean): string[] {
  return getColumnDefs(showBookkeeping).map((c) => c.header);
}

export async function buildInvoiceExportBuffer(
  rows: InvoiceListComputedRow[],
  showBookkeeping: boolean
): Promise<Buffer> {
  const cols = getColumnDefs(showBookkeeping);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "InvoiceKu";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Invoice");
  sheet.addRow(cols.map((c) => c.header));

  for (const inv of rows) {
    const data = mapInvoiceToRow(inv, showBookkeeping);
    sheet.addRow(cols.map((c) => data[c.key] ?? null));
  }

  applyInvoiceSheetFormatting(sheet, cols, rows.length);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export type { InvoiceListFilters };
