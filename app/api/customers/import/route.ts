export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireApiContext } from "@/lib/api-context";
import {
  buildExistingKeySet,
  duplicateKey,
  mapPaperIdRow,
  type ImportSummary,
  type MappedCustomerDraft,
  type PaperIdRawRow,
} from "@/lib/paper-id-customer-import";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const INSERT_CHUNK = 50;

type StagedRow = { excelRow: number; data: MappedCustomerDraft };

export async function POST(req: NextRequest) {
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;

  const { supabase, orgId } = auth.ctx;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Form upload tidak valid" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "File Excel wajib (field: file)" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File terlalu besar (maks 5 MB)" }, { status: 400 });
  }

  const fileName = file instanceof File ? file.name : "upload.xlsx";
  if (!/\.(xlsx|xls)$/i.test(fileName)) {
    return NextResponse.json({ error: "Format file harus .xlsx atau .xls" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let rawRows: PaperIdRawRow[];
  try {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "Excel tidak memiliki sheet" }, { status: 400 });
    }
    rawRows = XLSX.utils.sheet_to_json<PaperIdRawRow>(wb.Sheets[sheetName], { defval: "" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal membaca Excel";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (rawRows.length === 0) {
    return NextResponse.json({ error: "Excel tidak memiliki baris data" }, { status: 400 });
  }

  const { data: existingRows, error: existErr } = await supabase
    .from("customers")
    .select("name, phone")
    .eq("org_id", orgId);

  if (existErr) {
    return NextResponse.json({ error: existErr.message }, { status: 400 });
  }

  const existingKeys = buildExistingKeySet(
    (existingRows || []).map((r) => ({
      name: String((r as { name?: string }).name || ""),
      phone: ((r as { phone?: string | null }).phone as string | null) ?? null,
    }))
  );

  const summary: ImportSummary = {
    totalRows: rawRows.length,
    imported: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  const staged: StagedRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const excelRow = i + 2;
    const outcome = mapPaperIdRow(rawRows[i], excelRow);
    if (!outcome.ok) {
      summary.skipped++;
      summary.details.push({
        excelRow: outcome.excelRow,
        status: "skipped",
        name: outcome.name,
        reason: outcome.reason,
      });
      continue;
    }
    staged.push({ excelRow, data: outcome.data });
  }

  const seenInFile = new Set<string>();
  const toInsert: StagedRow[] = [];

  for (const row of staged) {
    const key = duplicateKey(row.data.name, row.data.phone);
    if (seenInFile.has(key)) {
      summary.skipped++;
      summary.details.push({
        excelRow: row.excelRow,
        status: "skipped",
        name: row.data.name,
        reason: "Duplikat di file Excel (nama + telepon sama)",
      });
      continue;
    }
    seenInFile.add(key);

    if (existingKeys.has(key)) {
      summary.skipped++;
      summary.details.push({
        excelRow: row.excelRow,
        status: "skipped",
        name: row.data.name,
        reason: "Sudah ada di database (nama + telepon sama)",
      });
      continue;
    }

    toInsert.push(row);
  }

  for (let c = 0; c < toInsert.length; c += INSERT_CHUNK) {
    const chunk = toInsert.slice(c, c + INSERT_CHUNK);
    const payload = chunk.map((row) => ({
      org_id: orgId,
      name: row.data.name,
      phone: row.data.phone,
      address: row.data.address,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("customers")
      .insert(payload)
      .select("id, name");

    if (!insErr && inserted) {
      summary.imported += inserted.length;
      for (let j = 0; j < inserted.length; j++) {
        summary.details.push({
          excelRow: chunk[j].excelRow,
          status: "imported",
          name: (inserted[j] as { name?: string }).name,
        });
      }
      continue;
    }

    for (const row of chunk) {
      const { error: oneErr } = await supabase.from("customers").insert({
        org_id: orgId,
        name: row.data.name,
        phone: row.data.phone,
        address: row.data.address,
      });

      if (oneErr) {
        summary.failed++;
        summary.details.push({
          excelRow: row.excelRow,
          status: "failed",
          name: row.data.name,
          reason: oneErr.message,
        });
      } else {
        summary.imported++;
        summary.details.push({
          excelRow: row.excelRow,
          status: "imported",
          name: row.data.name,
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    org_id: orgId,
    duplicate_rule:
      "Lewati baris jika nama+telepon (hanya digit) sama dengan customer di org ini, atau duplikat di file. Jika telepon kosong, hanya nama (normalized) yang dibandingkan.",
    summary,
  });
}
