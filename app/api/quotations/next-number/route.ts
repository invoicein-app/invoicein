// =========================================
// 2B) API: Next Quotation Number (simple)
// app/api/quotations/next-number/route.ts
// =========================================
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { coerceDateOrToday, generateDocumentNumber } from "@/lib/document-numbering";

export async function POST(req: Request) {
  // cookies() kadang ke-typing Promise di beberapa versi Next — handle dua-duanya.
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  // user (RLS)
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  const { data: userRes } = await supabaseUser.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // get org_id
  const { data: membership } = await supabaseUser
    .from("memberships")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const orgId = String((membership as any)?.org_id || "");
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const quotationDate = coerceDateOrToday((body as any)?.quotation_date);
  const quotation_number = await generateDocumentNumber({
    orgId,
    docType: "quotation",
    documentDate: quotationDate,
  });
  return NextResponse.json({ quotation_number });
}