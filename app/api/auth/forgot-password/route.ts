/**
 * Send Supabase "reset password" email.
 * Redirects back to our /reset-password page with recovery tokens.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { forgotPasswordBodySchema } from "@/lib/validations/auth";

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req, forgotPasswordBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const email = parsedBody.data.email;

  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("host");
  const origin = host ? `${proto}://${host}` : url.origin;

  const redirectTo = `${origin}/reset-password`;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Supabase env belum di-set." }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Important: Return a generic success message from UI to avoid leaking whether email exists.
  // Supabase resetPasswordForEmail typically behaves safely, but we keep UX simple here.
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    return NextResponse.json({ error: error.message || "Gagal mengirim link reset password." }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

