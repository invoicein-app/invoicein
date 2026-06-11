export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { buildInvoiceExportBuffer } from "@/lib/invoice-export";
import {
  buildInvoiceExportFilename,
  fetchAllFilteredInvoices,
  parseInvoiceListFilters,
} from "@/lib/invoice-list-utils";
import { loadBookkeepingPreference } from "@/lib/member-preferences";

export async function GET(req: NextRequest) {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;

  const { supabase, user, orgId } = auth.ctx;
  const filters = parseInvoiceListFilters(new URL(req.url).searchParams);

  let showBookkeeping = false;
  const pref = await loadBookkeepingPreference(user.id, orgId);
  if (pref.ok) showBookkeeping = pref.show_invoice_bookkeeping_status;

  try {
    const rows = await fetchAllFilteredInvoices(supabase, filters);
    const buffer = await buildInvoiceExportBuffer(rows, showBookkeeping);
    const filename = buildInvoiceExportFilename(filters);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal mengekspor invoice";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
