export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireCanWrite } from "@/lib/subscription";
import { coerceDateOrToday, peekDocumentNumber } from "@/lib/document-numbering";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { peekQuotationNumberBodySchema } from "@/lib/validations/quotation";

export async function POST(req: Request) {
  try {
    const csAny: any = cookies() as any;
    const cookieStore: any = csAny?.then ? await csAny : csAny;

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }: any) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", userRes.user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const orgId = String((membership as any)?.org_id || "");
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const subBlock = await requireCanWrite(supabase, orgId);
    if (subBlock) return subBlock;

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
