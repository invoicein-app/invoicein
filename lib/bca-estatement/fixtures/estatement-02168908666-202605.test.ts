import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { extractPdfText } from "@/lib/bca-estatement/extract-pdf-text";
import { parseBcaEstatementText } from "@/lib/bca-estatement/parse-bca-estatement";

const PDF_PATH = "f:/Download Google/ESTATEMENT_02168908666_202605.pdf";
const FIXTURE_TEXT = path.join(__dirname, "estatement-02168908666-202605.extracted.txt");

describe("real e-statement SURYA VENEER CV Mei 2026", () => {
  const text = fs.readFileSync(FIXTURE_TEXT, "utf8");
  const result = parseBcaEstatementText(text);

  it("parses all 49 transactions without incomplete-row warnings", () => {
    const incomplete = result.warnings.filter((w) => w.code === "incomplete_row");
    expect(incomplete).toEqual([]);
    expect(result.transactions.length).toBe(49);
  });

  it("matches parsed CR/DB counts", () => {
    expect(result.transactions.filter((t) => t.tipeMutasi === "CR").length).toBe(9);
    expect(result.transactions.filter((t) => t.tipeMutasi === "DB").length).toBe(40);
  });

  it("parses BI-FAST and TRSF E-BANKING samples", () => {
    const bifast = result.transactions.find(
      (t) =>
        t.keteranganUtama.includes("BI-FAST DB BIF TRANSFER KE") && t.nominal === 1_950_000
    );
    expect(bifast?.namaLawanTransaksi).toMatch(/MOCHAMAD HUDORI/i);
    expect(bifast?.saldo).toBe(67_285_060.75);

    const trsfCr = result.transactions.find((t) =>
      t.keteranganUtama.includes("0705/FTSCY/WS95271")
    );
    expect(trsfCr?.tipeMutasi).toBe("CR");
    expect(trsfCr?.nominal).toBe(62_219_095);
    expect(trsfCr?.saldo).toBe(127_421_655.75);
  });

  it.skipIf(!fs.existsSync(PDF_PATH))("parses the original PDF end-to-end", async () => {
    const buffer = fs.readFileSync(PDF_PATH);
    const extracted = await extractPdfText(buffer);
    const parsed = parseBcaEstatementText(extracted);
    expect(parsed.warnings.filter((w) => w.code === "incomplete_row")).toEqual([]);
    expect(parsed.transactions.length).toBe(49);
  });
});
