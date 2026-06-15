export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { loginOrgBodySchema } from "@/lib/validations/auth";
import { formatAuthErrorMessage } from "@/lib/auth-error-messages";

function normalizeUsername(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function normalizeOrgCode(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function makeInternalEmail(username: string, orgCode: string) {
  return `${normalizeUsername(username)}+${normalizeOrgCode(orgCode)}@invoiceku.local`;
}

export async function POST(req: NextRequest) {
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  const parsedBody = await parseJsonBody(req, loginOrgBodySchema);
  if (!parsedBody.ok) return parsedBody.response;

  const orgCode = normalizeOrgCode(parsedBody.data.org_code);
  const uname = normalizeUsername(parsedBody.data.username);
  const pass = parsedBody.data.password;

  if (!orgCode) return NextResponse.json({ error: "org_code wajib" }, { status: 400 });
  if (!uname) return NextResponse.json({ error: "username wajib" }, { status: 400 });

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

  const email = makeInternalEmail(uname, orgCode);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: formatAuthErrorMessage(error, "Login gagal") },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}