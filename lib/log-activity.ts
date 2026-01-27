// lib/activity-log.ts
import { headers, cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export type LogActivityInput = {
  org_id: string;
  actor_user_id: string;
  actor_role: string;        // snapshot: staff/admin/owner
  action: string;            // "invoice.payment.create" dll
  entity_type: string;       // "invoice" / "payment" / "staff"
  entity_id?: string | null;
  summary?: string | null;
  meta?: any;                // json
};

export async function logActivity(input: LogActivityInput) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;

    const ua = h.get("user-agent") || null;

    const payload = {
      org_id: input.org_id,
      actor_user_id: input.actor_user_id,
      actor_role: input.actor_role || "staff",
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      summary: input.summary ?? null,
      meta: input.meta ?? {},
      ip,
      user_agent: ua,
    };

    await supabase.from("activity_logs").insert(payload);
  } catch {
    // IMPORTANT: jangan bikin API gagal hanya karena log gagal
  }
}