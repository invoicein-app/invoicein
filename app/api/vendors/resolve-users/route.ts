// POST { ids: string[] } -> { labels: Record<userId, displayName> } using service role (optional)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { resolveUsersBodySchema } from "@/lib/validations/vendor";

export async function POST(req: Request) {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;

  const parsedBody = await parseJsonBody(req, resolveUsersBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const ids = [...new Set(parsedBody.data.ids)];

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const labels: Record<string, string> = {};
    return NextResponse.json({ labels }, { status: 200 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const labels: Record<string, string> = {};

  await Promise.all(
    ids.map(async (id) => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(id);
        if (error || !data?.user) return;
        const u = data.user;
        const meta = u.user_metadata as Record<string, unknown> | undefined;
        const name =
          (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
          (typeof meta?.name === "string" && meta.name.trim()) ||
          (u.email ? u.email.split("@")[0] : "") ||
          "—";
        labels[id] = name;
      } catch {
        /* skip */
      }
    })
  );

  return NextResponse.json({ labels }, { status: 200 });
}
