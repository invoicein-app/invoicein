export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { coerceDateOrToday, peekDocumentNumber } from "@/lib/document-numbering";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { peekQuotationNumberBodySchema } from "@/lib/validations/quotation";

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext({ requireWrite: true });
    if (!auth.ok) return auth.response;
    const { orgId } = auth.ctx;

    const parsedBody = await parseJsonBody(req, peekQuotationNumberBodySchema);
    if (!parsedBody.ok) return parsedBody.response;
    const quotationDate = coerceDateOrToday(parsedBody.data.quotation_date);
    const quotation_number = await peekDocumentNumber({
      orgId,
      docType: "quotation",
      documentDate: quotationDate,
    });

    return NextResponse.json({ quotation_number });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to preview quotation number." }, { status: 500 });
  }
}
