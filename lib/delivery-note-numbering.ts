import type { SupabaseClient } from "@supabase/supabase-js";
import { coerceDateOrToday, padSequence } from "@/lib/document-numbering";

function formatYyyymmdd(dateLike: string) {
  const normalized = coerceDateOrToday(dateLike);
  const [y, m, d] = normalized.split("-");
  return `${y}${m}${d}`;
}

function parseSjSequence(sjNumber: string) {
  const match = String(sjNumber || "").match(/-(\d{4})$/);
  if (!match) return 0;
  const seq = Number(match[1]);
  return Number.isFinite(seq) ? seq : 0;
}

/** Reserve the next SJ number for a date, reconciling counters with existing rows. */
export async function allocateDeliveryNoteNumber(
  admin: SupabaseClient,
  orgId: string,
  sjDate: string
): Promise<string> {
  const yyyymmdd = formatYyyymmdd(sjDate);
  const prefix = `SJ-${yyyymmdd}-`;

  const { data: rows, error: rowsErr } = await admin
    .from("delivery_notes")
    .select("sj_number")
    .like("sj_number", `${prefix}%`);

  if (rowsErr) {
    throw new Error(rowsErr.message);
  }

  let maxSeq = 0;
  for (const row of rows || []) {
    maxSeq = Math.max(maxSeq, parseSjSequence(String((row as { sj_number?: string }).sj_number || "")));
  }

  const { data: counter, error: counterErr } = await admin
    .from("doc_counters")
    .select("last_number")
    .eq("org_id", orgId)
    .eq("doc_type", "delivery_note")
    .eq("yyyymmdd", yyyymmdd)
    .maybeSingle();

  if (counterErr) {
    throw new Error(counterErr.message);
  }

  const counterSeq = Number((counter as { last_number?: number } | null)?.last_number ?? 0);
  const nextSeq = Math.max(maxSeq, counterSeq) + 1;

  const { error: upErr } = await admin.from("doc_counters").upsert(
    {
      org_id: orgId,
      doc_type: "delivery_note",
      yyyymmdd,
      last_number: nextSeq,
    },
    { onConflict: "org_id,doc_type,yyyymmdd" }
  );

  if (upErr) {
    throw new Error(upErr.message);
  }

  return `${prefix}${padSequence(nextSeq)}`;
}

export function isSjNumberDuplicateError(err: unknown) {
  const msg = String((err as { message?: string })?.message || "").toLowerCase();
  return msg.includes("sj_number");
}

export function isInvoiceDeliveryNoteDuplicateError(err: unknown) {
  const msg = String((err as { message?: string })?.message || "").toLowerCase();
  return msg.includes("delivery_notes_org_invoice_uniq") || msg.includes("invoice_id");
}

export async function insertDeliveryNoteWithAllocatedNumber(args: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  orgId: string;
  sjDate: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}): Promise<{ data: { id: string } | null; error: unknown | null }> {
  const maxAttempts = args.maxAttempts ?? 4;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const sjNumber = await allocateDeliveryNoteNumber(args.admin, args.orgId, args.sjDate);
    const { data, error } = await args.supabase
      .from("delivery_notes")
      .insert({
        ...args.payload,
        sj_date: args.sjDate,
        sj_number: sjNumber,
      })
      .select("id")
      .maybeSingle();

    if (!error) {
      return { data: data?.id ? { id: String(data.id) } : null, error: null };
    }

    lastErr = error;
    if (String((error as { code?: string }).code || "") !== "23505") break;
    if (!isSjNumberDuplicateError(error)) break;
  }

  return { data: null, error: lastErr };
}
