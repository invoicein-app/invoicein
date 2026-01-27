// app/settings/staff/page.tsx
// FULL REPLACE — server guard (admin only) + render client page
export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ⬇️ ini client component kamu (yang panjang itu)
import StaffSettingsClient from "./staff-settings-client";

export default async function StaffSettingsPage() {
  // cookies() kadang ke-typing Promise di beberapa versi Next
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

  // auth
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) redirect("/login");

  // role gate
  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("role, org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // kalau query error / tidak ada membership / bukan admin -> mental
  if (memErr || !mem || mem.role !== "admin") redirect("/settings");

  // ✅ admin boleh masuk
  return <StaffSettingsClient />;
}