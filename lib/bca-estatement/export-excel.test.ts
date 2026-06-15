import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildBcaEstatementExportBuffer } from "@/lib/bca-estatement/export-excel";
import type { BcaParseResult } from "@/lib/bca-estatement/types";

const sampleResult: BcaParseResult = {
  ok: true,
  metadata: {
    accountName: "SURYA VENEER CV",
    accountNumber: "2168908666",
    periodLabel: "MEI 2026",
    periodMonth: 5,
    periodYear: 2026,
    currency: "IDR",
  },
  summary: {
    saldoAwal: 1000,
    totalMutasiCr: 500,
    totalMutasiDb: 200,
    saldoAkhir: 1300,
    jumlahTransaksiCr: 1,
    jumlahTransaksiDb: 1,
  },
  transactions: [
    {
      tanggal: "01/05",
      tanggalDate: "2026-05-01",
      tipeMutasi: "DB",
      nominal: 1_950_000,
      saldo: 67_285_060.75,
      keteranganUtama: "BI-FAST DB BIF TRANSFER KE",
      keteranganDetail: "009 MOCHAMAD HUDORI KBB",
      namaLawanTransaksi: "MOCHAMAD HUDORI",
      channel: "BI-FAST",
      cbg: null,
      noReferensi: null,
      rawText: "01/05 BI-FAST DB BIF TRANSFER KE\n009\nMOCHAMAD HUDORI\nKBB\n1,950,000.00 DB",
    },
  ],
  warnings: [],
};

describe("buildBcaEstatementExportBuffer", () => {
  it("sets wrap text and auto row height on transaction sheet", async () => {
    const buffer = await buildBcaEstatementExportBuffer(sampleResult);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.getWorksheet("Transaksi");
    expect(sheet).toBeTruthy();

    const detailCell = sheet!.getRow(2).getCell(6);
    expect(detailCell.alignment?.wrapText).not.toBe(true);
    expect(sheet!.getRow(2).height).toBe(18);
    expect(sheet!.getColumn(6).width).toBeGreaterThan(20);

    const rawCol = sheet!.getColumn(11);
    expect(rawCol.hidden).toBe(true);
  });
});
