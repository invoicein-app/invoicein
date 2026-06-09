// app/api/org/profile/route.ts (FULL FILE)
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requireCanWrite } from "@/lib/subscription";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { updateOrgProfileBodySchema } from "@/lib/validations/org";

function cleanCode(v: unknown, maxLen = 12) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, maxLen);
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // org user dari memberships (org pertama)
  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memErr || !mem?.org_id) {
    return NextResponse.json({ error: "No organization found for this user." }, { status: 400 });
  }

  const parsedBody = await parseJsonBody(req, updateOrgProfileBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const subBlock = await requireCanWrite(supabase, mem.org_id);
  if (subBlock) return subBlock;

  // Only allow updating fields we expect (biar aman)
  const publicCode = cleanCode(body.public_document_code, 12);
  const invoicePrefix = cleanCode(body.invoice_prefix, 12) || "INV";
  const poPrefix = cleanCode(body.po_prefix, 12) || "PO";
  const quotationPrefix = cleanCode(body.quotation_prefix, 12) || "QUO";

  if (!invoicePrefix || !poPrefix || !quotationPrefix) {
    return NextResponse.json({ error: "Prefix dokumen tidak valid." }, { status: 400 });
  }

  const payload = {
    name: body.name,
    address: body.address,
    phone: body.phone,
    email: body.email,
    bank_name: body.bank_name,
    bank_account: body.bank_account,
    bank_account_name: body.bank_account_name,
    invoice_footer: body.invoice_footer,
    public_document_code: publicCode || null,
    invoice_prefix: invoicePrefix,
    po_prefix: poPrefix,
    quotation_prefix: quotationPrefix,
  };

  // update by org_id from membership (bukan dari body.id)
  const { error: updErr } = await supabase
    .from("organizations")
    .update(payload)
    .eq("id", mem.org_id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}