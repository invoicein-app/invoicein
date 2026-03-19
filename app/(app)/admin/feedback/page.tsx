/**
 * Admin inbox: Kritik & Masukan (feedback review).
 * Accessible only for org role=admin.
 */
export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import AdminFeedbackClient from "./admin-feedback-client";

export default async function AdminFeedbackPage() {
  const csAny: any = cookies() as any;
  const cookieStore = csAny?.then ? await csAny : csAny;

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
  const user = userRes?.user;
  if (!user) redirect("/dashboard");

  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id, role, is_active, organizations(org_code)")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!mem?.org_id) redirect("/dashboard");

  return (
    <div style={{ maxWidth: 860, padding: "0 8px" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Kritik & Masukan</h1>
        <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14 }}>
          Inbox untuk ulasan pengguna. Anda bisa meninjau dan memperbarui status feedback.
        </p>
      </div>
      <AdminFeedbackClient />
    </div>
  );
}

