export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/api-context";
import { buildBcaEstatementExportBuffer } from "@/lib/bca-estatement/export-excel";
import type { BcaParseResult } from "@/lib/bca-estatement/types";

const transactionSchema = z.object({
  tanggal: z.string(),
  tanggalDate: z.string().nullable(),
  tipeMutasi: z.enum(["CR", "DB"]),
  nominal: z.number(),
  saldo: z.number().nullable(),
  keteranganUtama: z.string(),
  keteranganDetail: z.string(),
  namaLawanTransaksi: z.string().nullable(),
  channel: z.string().nullable(),
  cbg: z.string().nullable(),
  noReferensi: z.string().nullable(),
  rawText: z.string(),
});

const exportBodySchema = z.object({
  metadata: z.object({
    accountName: z.string().nullable(),
    accountNumber: z.string().nullable(),
    periodLabel: z.string().nullable(),
    periodMonth: z.number().nullable(),
    periodYear: z.number().nullable(),
    currency: z.string().nullable(),
  }),
  summary: z.object({
    saldoAwal: z.number().nullable(),
    totalMutasiCr: z.number().nullable(),
    totalMutasiDb: z.number().nullable(),
    saldoAkhir: z.number().nullable(),
    jumlahTransaksiCr: z.number().nullable(),
    jumlahTransaksiDb: z.number().nullable(),
  }),
  transactions: z.array(transactionSchema).min(1),
  warnings: z
    .array(z.object({ code: z.string(), message: z.string() }))
    .optional()
    .default([]),
});

export async function POST(req: NextRequest) {
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 });
  }

  const parsed = exportBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data export tidak valid", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload: BcaParseResult = {
    ok: true,
    metadata: parsed.data.metadata,
    summary: parsed.data.summary,
    transactions: parsed.data.transactions,
    warnings: parsed.data.warnings,
  };

  try {
    const buffer = await buildBcaEstatementExportBuffer(payload);
    const account = payload.metadata.accountNumber || "bca";
    const period = (payload.metadata.periodLabel || "statement").replace(/\s+/g, "-").toLowerCase();
    const filename = `bca-estatement-${account}-${period}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal membuat Excel";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
