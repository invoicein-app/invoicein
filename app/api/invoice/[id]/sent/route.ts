export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { finalizeInvoice } from "@/lib/invoice-finalize";
import { requireCanWrite } from "@/lib/subscription";

function isUuid(v: unknown) {
  const s = String(v || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const invoiceId = String(id || "").trim();

  if (!isUuid(invoiceId)) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

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

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = userRes.user;

  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 400 });
  }
  if (!mem?.org_id) {
    return NextResponse.json({ error: "Org tidak ditemukan" }, { status: 400 });
  }

  const orgId = String((mem as any).org_id);
  const actorRole = String((mem as any).role || "staff");

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const result = await finalizeInvoice({
    supabase,
    orgId,
    invoiceId,
    userId: user.id,
    actorRole,
    fromLegacySend: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json(
    {
      ok: true,
      status: result.status,
      stock_moved: result.stock_moved,
      reason: result.reason,
    },
    { status: 200 }
  );
}
