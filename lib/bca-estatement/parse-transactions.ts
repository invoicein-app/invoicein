import { extractTrailingAmount, parseIndonesianAmount } from "./amounts";
import { CHANNEL_RULES } from "./constants";
import type { BcaParseWarning, BcaTransaction, MutasiType } from "./types";

const DATE_PREFIX = /^(\d{2}\/\d{2})\s+([\s\S]*)$/;
const REF_PATTERNS = [
  /\b(\d{4}\/[A-Z0-9]+\/[A-Z0-9]+)\b/i,
  /\b(\d{2}\/\d{2}\s*\/\d+\/\d+)\b/,
  /\b(\d{12,})\b/,
  /\b(\d{4}\/ADSCY\/\d+)\b/i,
  /\b(\d{4}\/FTFVA\/\w+)\b/i,
  /\b(\d{4}\/ACSCY\/\d+)\b/i,
];

const TRANSFER_NAME_PATTERNS = [
  /TRANSFER\s+(?:KE|DR)\s+\d+\s+(.+?)(?:\/|$)/i,
  /TRANSFER\s+(?:KE|DR)\s+(.+?)(?:\/|$)/i,
  /\/([A-Z0-9][A-Z0-9\s\.\-]{2,40})\/B(?:TPN|ANK)/i,
];

function inferMutasiType(body: string, explicit: MutasiType | null): MutasiType | null {
  if (explicit) return explicit;

  const upper = body.toUpperCase();

  if (/SWITCHING\s+CR/.test(upper)) return "CR";
  if (/SWITCHING\s+DB/.test(upper)) return "DB";
  if (/BI-FAST\s+CR/.test(upper)) return "CR";
  if (/BI-FAST\s+DB|BIAYA TXN/.test(upper)) return "DB";
  if (/BYR\s+VIA\s+E-BANKING/.test(upper)) return "DB";
  if (/TRSF\s+E-BANKING\s+CR/.test(upper)) return "CR";
  if (/TRSF\s+E-BANKING\s+DB/.test(upper)) return "DB";
  if (/KR OTOMATIS|\bKR\b/.test(upper)) return "CR";
  if (/DB OTOMATIS/.test(upper)) return "DB";
  if (/SETORAN/.test(upper)) return "CR";
  if (/TARIKAN/.test(upper)) return "DB";
  if (/BIAYA ADM|PAJAK BUNGA/.test(upper)) return "DB";
  if (/\bBUNGA\b/.test(upper)) return "CR";
  if (/\bCR\b/.test(upper)) return "CR";
  if (/\bDB\b/.test(upper)) return "DB";

  return null;
}

function detectChannel(body: string): string | null {
  for (const rule of CHANNEL_RULES) {
    if (rule.pattern.test(body)) return rule.channel;
  }
  return null;
}

function extractReference(body: string): string | null {
  for (const pattern of REF_PATTERNS) {
    const match = body.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractCounterparty(main: string, details: string[]): string | null {
  const textDetails = details.filter((d) => !isFinancialDetailLine(d));
  const combined = [main, ...textDetails].join(" ");
  for (const pattern of TRANSFER_NAME_PATTERNS) {
    const match = combined.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  const detailCandidate = textDetails
    .map((d) => d.trim())
    .filter((d) => d.length >= 3 && !/^\d/.test(d) && !/^TANGGAL\s*:/i.test(d))
    .filter((d) => !/^\d{1,3}(?:,\d{3})*\.?\d*$/.test(d))
    .filter((d) => !/^\d{3}$/.test(d))
    .filter((d) => !/^KBB$/i.test(d));

  if (detailCandidate.length) {
    return detailCandidate[detailCandidate.length - 1];
  }

  return null;
}

function splitMainAndDetails(firstLineBody: string, detailLines: string[]): {
  keteranganUtama: string;
  keteranganDetail: string;
} {
  const textDetails = detailLines.filter((d) => !isFinancialDetailLine(d));
  const detailText = textDetails.join(" ").replace(/\s+/g, " ").trim();
  const main = firstLineBody.replace(/\s+/g, " ").trim();
  return {
    keteranganUtama: main,
    keteranganDetail: detailText,
  };
}

function extractFinancialsFromDetails(
  detailLines: string[]
): { nominal: number | null; saldo: number | null; tipeMutasi: MutasiType | null } {
  const financial = detailLines
    .filter((line) => isFinancialDetailLine(line))
    .map((line) => parseFinancialDetailLine(line));

  if (!financial.length) {
    return { nominal: null, saldo: null, tipeMutasi: null };
  }

  if (financial.length === 1) {
    const f = financial[0];
    return { nominal: f.nominal, saldo: f.saldo, tipeMutasi: f.tipeMutasi };
  }

  const last = financial[financial.length - 1];
  const prev = financial[financial.length - 2];

  if (last.nominal != null && last.saldo == null && !last.tipeMutasi && prev.nominal != null) {
    if (prev.tipeMutasi || prev.saldo != null) {
      return {
        nominal: prev.nominal,
        saldo: last.nominal,
        tipeMutasi: prev.tipeMutasi,
      };
    }
    return { nominal: prev.nominal, saldo: last.nominal, tipeMutasi: null };
  }

  return {
    nominal: last.nominal,
    saldo: last.saldo,
    tipeMutasi: last.tipeMutasi ?? prev.tipeMutasi,
  };
}

function mergeFinancials(
  first: ReturnType<typeof parseLineAmounts>,
  detailLines: string[]
): { nominal: number | null; saldo: number | null; tipeMutasi: MutasiType | null; cbg: string | null } {
  const fromDetails = extractFinancialsFromDetails(detailLines);

  return {
    nominal: first.nominal ?? fromDetails.nominal,
    saldo: first.saldo ?? fromDetails.saldo,
    tipeMutasi: first.tipeMutasi ?? fromDetails.tipeMutasi,
    cbg: first.cbg,
  };
}

const AMOUNT_TOKEN = "(\\d{1,3}(?:,\\d{3})+\\.\\d{2}|\\d+\\.\\d{2})";

export function isFinancialDetailLine(line: string): boolean {
  const trimmed = line.trim();
  return new RegExp(
    `^${AMOUNT_TOKEN}(\\s+(?:DB|CR|KR))?(\\s+${AMOUNT_TOKEN})?$`,
    "i"
  ).test(trimmed);
}

export function parseFinancialDetailLine(line: string): {
  nominal: number | null;
  saldo: number | null;
  tipeMutasi: MutasiType | null;
} {
  const trimmed = line.trim();

  const flagSaldo = trimmed.match(
    new RegExp(`^${AMOUNT_TOKEN}\\s+(DB|CR|KR)\\s+${AMOUNT_TOKEN}$`, "i")
  );
  if (flagSaldo) {
    return {
      nominal: parseIndonesianAmount(flagSaldo[1]),
      tipeMutasi:
        flagSaldo[2].toUpperCase() === "KR" ? "CR" : (flagSaldo[2].toUpperCase() as MutasiType),
      saldo: parseIndonesianAmount(flagSaldo[3]),
    };
  }

  const flagOnly = trimmed.match(new RegExp(`^${AMOUNT_TOKEN}\\s+(DB|CR|KR)$`, "i"));
  if (flagOnly) {
    return {
      nominal: parseIndonesianAmount(flagOnly[1]),
      tipeMutasi:
        flagOnly[2].toUpperCase() === "KR" ? "CR" : (flagOnly[2].toUpperCase() as MutasiType),
      saldo: null,
    };
  }

  const twoAmounts = trimmed.match(new RegExp(`^${AMOUNT_TOKEN}\\s+${AMOUNT_TOKEN}$`));
  if (twoAmounts) {
    return {
      nominal: parseIndonesianAmount(twoAmounts[1]),
      saldo: parseIndonesianAmount(twoAmounts[2]),
      tipeMutasi: null,
    };
  }

  const oneAmount = trimmed.match(new RegExp(`^${AMOUNT_TOKEN}$`));
  if (oneAmount) {
    return {
      nominal: parseIndonesianAmount(oneAmount[1]),
      saldo: null,
      tipeMutasi: null,
    };
  }

  return { nominal: null, saldo: null, tipeMutasi: null };
}

export function parseLineAmounts(body: string): {
  keteranganBody: string;
  cbg: string | null;
  nominal: number | null;
  saldo: number | null;
  tipeMutasi: import("./types").MutasiType | null;
} {
  let rest = body.trim();
  let saldo: number | null = null;
  let nominal: number | null = null;
  let tipeMutasi: MutasiType | null = null;

  const amountPattern = "(\\d{1,3}(?:,\\d{3})+\\.\\d{2}|\\d+\\.\\d{2})";

  const mutasiFlagSaldo = rest.match(
    new RegExp(`^([\\s\\S]+?)\\s+${amountPattern}\\s+\\b(DB|CR|KR)\\b\\s+${amountPattern}\\s*$`, "i")
  );
  if (mutasiFlagSaldo) {
    rest = mutasiFlagSaldo[1].trim();
    nominal = parseIndonesianAmount(mutasiFlagSaldo[2]);
    tipeMutasi =
      mutasiFlagSaldo[3].toUpperCase() === "KR"
        ? "CR"
        : (mutasiFlagSaldo[3].toUpperCase() as MutasiType);
    saldo = parseIndonesianAmount(mutasiFlagSaldo[4]);
  } else {
    const mutasiSaldo = rest.match(
      new RegExp(`^([\\s\\S]+?)\\s+${amountPattern}\\s+${amountPattern}\\s*$`, "i")
    );
    if (mutasiSaldo) {
      rest = mutasiSaldo[1].trim();
      nominal = parseIndonesianAmount(mutasiSaldo[2]);
      saldo = parseIndonesianAmount(mutasiSaldo[3]);
    } else {
      const mutasiFlag = rest.match(
        new RegExp(`^([\\s\\S]+?)\\s+${amountPattern}\\s+\\b(DB|CR|KR)\\b\\s*$`, "i")
      );
      if (mutasiFlag) {
        rest = mutasiFlag[1].trim();
        nominal = parseIndonesianAmount(mutasiFlag[2]);
        tipeMutasi =
          mutasiFlag[3].toUpperCase() === "KR"
            ? "CR"
            : (mutasiFlag[3].toUpperCase() as MutasiType);
      } else {
        const one = extractTrailingAmount(rest);
        if (one) {
          nominal = one.amount;
          rest = one.rest;
        }
      }
    }
  }

  const cbgMatch = rest.match(/\b(\d{4})\s*$/);
  const cbg = cbgMatch?.[1] ?? null;
  if (cbgMatch) {
    rest = rest.slice(0, rest.length - cbgMatch[0].length).trim();
  }

  return {
    keteranganBody: rest,
    cbg,
    nominal,
    saldo,
    tipeMutasi,
  };
}

function isSaldoAwalRow(body: string): boolean {
  return /^SALDO AWAL\b/i.test(body.trim());
}

export function parseTransactionBlock(
  block: string,
  buildDate: (ddmm: string) => string | null
): { tx: BcaTransaction | null; warning?: BcaParseWarning } {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) {
    return { tx: null, warning: { code: "empty_block", message: "Blok transaksi kosong" } };
  }

  const firstMatch = lines[0].match(DATE_PREFIX);
  if (!firstMatch) {
    return {
      tx: null,
      warning: { code: "missing_date", message: `Baris tanpa tanggal: ${lines[0].slice(0, 80)}` },
    };
  }

  const tanggal = firstMatch[1];
  const firstBody = firstMatch[2];
  const detailLines = lines.slice(1);

  if (isSaldoAwalRow(firstBody)) {
    return { tx: null };
  }

  const parsed = parseLineAmounts(firstBody);
  const financials = mergeFinancials(parsed, detailLines);
  const tipeMutasi = inferMutasiType(block, financials.tipeMutasi);

  if (!tipeMutasi || financials.nominal == null) {
    return {
      tx: null,
      warning: {
        code: "incomplete_row",
        message: `Tidak dapat memetakan mutasi: ${tanggal} ${firstBody.slice(0, 60)}`,
      },
    };
  }

  const { keteranganUtama, keteranganDetail } = splitMainAndDetails(parsed.keteranganBody, detailLines);

  return {
    tx: {
      tanggal,
      tanggalDate: buildDate(tanggal),
      tipeMutasi,
      nominal: financials.nominal,
      saldo: financials.saldo,
      keteranganUtama,
      keteranganDetail,
      namaLawanTransaksi: extractCounterparty(keteranganUtama, detailLines),
      channel: detectChannel(block),
      cbg: financials.cbg,
      noReferensi: extractReference(block),
      rawText: block,
    },
  };
}

export function parseAllTransactions(
  blocks: string[],
  buildDate: (ddmm: string) => string | null
): { transactions: BcaTransaction[]; warnings: BcaParseWarning[] } {
  const transactions: BcaTransaction[] = [];
  const warnings: BcaParseWarning[] = [];

  for (const block of blocks) {
    const { tx, warning } = parseTransactionBlock(block, buildDate);
    if (tx) transactions.push(tx);
    if (warning) warnings.push(warning);
  }

  return { transactions, warnings };
}
