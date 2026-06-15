export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { extractPdfText } from "@/lib/bca-estatement/extract-pdf-text";
import { parseBcaEstatementText } from "@/lib/bca-estatement/parse-bca-estatement";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Form upload tidak valid" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "File PDF wajib (field: file)" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File terlalu besar (maks 10 MB)" }, { status: 400 });
  }

  const fileName = file instanceof File ? file.name : "upload.pdf";
  if (!/\.pdf$/i.test(fileName)) {
    return NextResponse.json({ error: "Format file harus .pdf" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    text = await extractPdfText(buffer);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal membaca PDF";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const result = parseBcaEstatementText(text);

  if (!result.transactions.length) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error || "Tidak ada transaksi yang berhasil diparse.",
        metadata: result.metadata,
        summary: result.summary,
        transactions: [],
        warnings: result.warnings,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    ok: result.ok,
    error: result.error,
    metadata: result.metadata,
    summary: result.summary,
    transactions: result.transactions,
    warnings: result.warnings,
    stats: {
      total: result.transactions.length,
      cr: result.transactions.filter((t) => t.tipeMutasi === "CR").length,
      db: result.transactions.filter((t) => t.tipeMutasi === "DB").length,
    },
  });
}
