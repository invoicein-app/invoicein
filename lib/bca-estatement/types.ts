export type MutasiType = "CR" | "DB";

export type BcaStatementMetadata = {
  accountName: string | null;
  accountNumber: string | null;
  periodLabel: string | null;
  periodMonth: number | null;
  periodYear: number | null;
  currency: string | null;
};

export type BcaStatementSummary = {
  saldoAwal: number | null;
  totalMutasiCr: number | null;
  totalMutasiDb: number | null;
  saldoAkhir: number | null;
  jumlahTransaksiCr: number | null;
  jumlahTransaksiDb: number | null;
};

export type BcaTransaction = {
  tanggal: string;
  tanggalDate: string | null;
  tipeMutasi: MutasiType;
  nominal: number;
  saldo: number | null;
  keteranganUtama: string;
  keteranganDetail: string;
  namaLawanTransaksi: string | null;
  channel: string | null;
  cbg: string | null;
  noReferensi: string | null;
  rawText: string;
};

export type BcaParseWarning = {
  code: string;
  message: string;
};

export type BcaParseResult = {
  ok: boolean;
  metadata: BcaStatementMetadata;
  summary: BcaStatementSummary;
  transactions: BcaTransaction[];
  warnings: BcaParseWarning[];
  error?: string;
};
