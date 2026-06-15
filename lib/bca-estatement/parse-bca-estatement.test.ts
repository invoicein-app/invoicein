import { describe, expect, it } from "vitest";
import { parseIndonesianAmount } from "@/lib/bca-estatement/amounts";
import {
  SAMPLE_BCA_ESTATEMENT_TEXT,
} from "@/lib/bca-estatement/fixtures/sample-text";
import {
  cleanStatementLines,
  groupTransactionBlocks,
  isNoiseLine,
  splitStatementLines,
} from "@/lib/bca-estatement/normalize-text";
import { parseBcaEstatementText } from "@/lib/bca-estatement/parse-bca-estatement";
import { extractMetadata, extractSummary } from "@/lib/bca-estatement/parse-metadata";
import { parseTransactionBlock, parseLineAmounts, isFinancialDetailLine, parseFinancialDetailLine } from "@/lib/bca-estatement/parse-transactions";

describe("parseIndonesianAmount", () => {
  it("parses comma-separated amounts", () => {
    expect(parseIndonesianAmount("9,568,973.90")).toBe(9568973.9);
    expect(parseIndonesianAmount("2,000.00")).toBe(2000);
  });
});

describe("BCA e-Statement text normalization", () => {
  it("skips repeated headers and footers", () => {
    const lines = splitStatementLines(SAMPLE_BCA_ESTATEMENT_TEXT);
    expect(lines.some((l) => isNoiseLine("TANGGAL KETERANGAN CBG MUTASI SALDO"))).toBe(true);
    expect(cleanStatementLines(lines).some((l) => /SALDO AWAL\s*:/i.test(l))).toBe(false);
  });

  it("groups multi-line transactions", () => {
    const blocks = groupTransactionBlocks(cleanStatementLines(splitStatementLines(SAMPLE_BCA_ESTATEMENT_TEXT)));
    const setoran = blocks.find((b) => b.includes("SETORAN TUNAI METRO PUTERA"));
    expect(setoran).toBeTruthy();
    expect(setoran).toContain("CENDIAWAN + AJI");
  });
});

describe("isFinancialDetailLine", () => {
  it("detects amount lines with optional DB flag and saldo", () => {
    expect(isFinancialDetailLine("2,500,000.00 DB")).toBe(true);
    expect(isFinancialDetailLine("12,345,678.90")).toBe(true);
    expect(isFinancialDetailLine("0141234567")).toBe(false);
    expect(isFinancialDetailLine("BUDI SANTOSO")).toBe(false);
  });

  it("parses standalone amount detail lines", () => {
    expect(parseFinancialDetailLine("2,500,000.00 DB")).toEqual({
      nominal: 2500000,
      saldo: null,
      tipeMutasi: "DB",
    });
    expect(parseFinancialDetailLine("12,345,678.90")).toEqual({
      nominal: 12345678.9,
      saldo: null,
      tipeMutasi: null,
    });
  });
});

describe("parseTransactionBlock", () => {
  const buildDate = (ddmm: string) => {
    const [dd, mm] = ddmm.split("/");
    return `2020-${mm}-${dd}`;
  };

  it("parses debit with DB flag and saldo", () => {
    const { tx } = parseTransactionBlock(
      "01/04 DB OTOMATIS B.ADM KLIRING 0372 2,000.00 DB 9,566,973.90",
      buildDate
    );
    expect(tx?.tipeMutasi).toBe("DB");
    expect(tx?.nominal).toBe(2000);
    expect(tx?.saldo).toBe(9566973.9);
    expect(tx?.cbg).toBe("0372");
  });

  it("parses credit transfer with detail lines", () => {
    const block = `01/04 TRSF E-BANKING CR 0104/FTSCY/WS95051 10,525,000.00
10525000.00
INV-200001735 26/3
PEPPERLUNCH BDG`;
    const { tx } = parseTransactionBlock(block, buildDate);
    expect(tx?.tipeMutasi).toBe("CR");
    expect(tx?.nominal).toBe(10525000);
    expect(tx?.channel).toBe("TRSF E-Banking");
    expect(tx?.noReferensi).toBe("0104/FTSCY/WS95051");
    expect(tx?.keteranganDetail).toContain("PEPPERLUNCH BDG");
  });

  it("parses TRSF E-BANKING when amount is on continuation lines", () => {
    const block = `07/05 TRSF E-BANKING CR 0705/FTSCY/WS95271
PEMBAYARAN INVOICE
PT CONTOH JAYA
1,000,000.00
1,500,000.00`;
    const { tx, warning } = parseTransactionBlock(block, buildDate);
    expect(warning).toBeUndefined();
    expect(tx?.tipeMutasi).toBe("CR");
    expect(tx?.nominal).toBe(1000000);
    expect(tx?.saldo).toBe(1500000);
  });

  it("parses BI-FAST transfer with amount on later lines", () => {
    const block = `01/05 BI-FAST DB BIF TRANSFER KE
BUDI SANTOSO
0141234567
2,500,000.00 DB
12,345,678.90`;
    const { tx } = parseTransactionBlock(block, buildDate);
    expect(tx?.tipeMutasi).toBe("DB");
    expect(tx?.nominal).toBe(2500000);
    expect(tx?.saldo).toBe(12345678.9);
    expect(tx?.channel).toBe("BI-FAST");
  });

  it("parses BI-FAST biaya txn fee", () => {
    const block = `01/05 BI-FAST DB BIF BIAYA TXN KE
BUDI SANTOSO
2,500.00 DB
12,343,178.90`;
    const { tx } = parseTransactionBlock(block, buildDate);
    expect(tx?.tipeMutasi).toBe("DB");
    expect(tx?.nominal).toBe(2500);
    expect(tx?.saldo).toBe(12343178.9);
  });

  it("parses bunga and pajak bunga", () => {
    const bunga = parseTransactionBlock("31/05 BUNGA 74,148.67", buildDate).tx;
    expect(bunga?.tipeMutasi).toBe("CR");
    expect(bunga?.nominal).toBe(74148.67);

    const pajak = parseTransactionBlock("31/05 PAJAK BUNGA 14,829.73 DB 125,794,085.91", buildDate).tx;
    expect(pajak?.tipeMutasi).toBe("DB");
    expect(pajak?.saldo).toBe(125794085.91);
  });
});

describe("parseBcaEstatementText", () => {
  it("extracts metadata and summary", () => {
    const meta = extractMetadata(SAMPLE_BCA_ESTATEMENT_TEXT);
    expect(meta.accountNumber).toBe("2883433432");
    expect(meta.periodLabel).toBe("APRIL 2020");
    expect(meta.currency).toBe("IDR");

    const summary = extractSummary(SAMPLE_BCA_ESTATEMENT_TEXT);
    expect(summary.saldoAwal).toBe(9568973.9);
    expect(summary.jumlahTransaksiCr).toBe(184);
    expect(summary.jumlahTransaksiDb).toBe(33);
    expect(summary.saldoAkhir).toBe(1757230.52);
  });

  it("parses transactions from sample excerpt", () => {
    const result = parseBcaEstatementText(SAMPLE_BCA_ESTATEMENT_TEXT);
    expect(result.ok).toBe(true);
    expect(result.transactions.length).toBeGreaterThan(5);

    const adm = result.transactions.find((t) => t.keteranganUtama.includes("B.ADM KLIRING"));
    expect(adm?.tipeMutasi).toBe("DB");

    const tarik = result.transactions.find((t) => t.keteranganUtama.includes("TARIKAN TUNAI"));
    expect(tarik?.tipeMutasi).toBe("DB");
    expect(tarik?.nominal).toBe(114000000);

    const switching = result.transactions.find((t) => t.channel === "Switching CR");
    expect(switching?.tipeMutasi).toBe("CR");
  });

  it("rejects unsupported text", () => {
    const result = parseBcaEstatementText("Hello world");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tidak dikenali/i);
  });

  it("merges page-break continuation into previous transaction", () => {
    const text = `${SAMPLE_BCA_ESTATEMENT_TEXT.split("02/04 TRSF E-BANKING CR 02/04 /95031/00000 175,000.00 9,240,573.90")[0]}
02/04 TRSF E-BANKING CR 02/04 /95031/00000 175,000.00 9,240,573.90
BAYAR BERAS MARTIN
MTH CORP
MARTIN SUBIANTO HA
02/04 TRSF E-BANKING CR 0204/FTSCY/WS95031 630,000.00 9,870,573.90
SALDO AWAL : 9,568,973.90 MUTASI CR : 2,080,147,026.77 184 MUTASI DB : 2,087,958,770.15 33 SALDO AKHIR : 1,757,230.52`;

    const result = parseBcaEstatementText(text);
    const martinTx = result.transactions.find((t) =>
      t.keteranganDetail.includes("MARTIN SUBIANTO HA")
    );
    expect(martinTx).toBeTruthy();
  });
});
