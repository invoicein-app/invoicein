export const runtime = "nodejs";

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import ActivityFeedClient from "./activity-feed-client";

export default async function ActivityLogPage() {
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

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return <div style={{ padding: 24 }}>Belum login</div>;

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) return <div style={{ padding: 24 }}>Tidak ada organisasi</div>;

  // RLS akan otomatis block kalau bukan admin/owner
  const { data: logs, error } = await supabase
    .from("activity_logs")
    .select("id, created_at, actor_role, action, entity_type, summary, meta")
    .eq("org_id", membership.org_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Akses ditolak / error</h2>
        <pre style={{ color: "#b00" }}>{error.message}</pre>
        <div style={{ marginTop: 10 }}>
          <Link href="/settings">← Kembali</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", padding: 24, boxSizing: "border-box", maxWidth: 900 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0f172a" }}>
            Activity Log
          </h1>
          <p style={{ marginTop: 6, marginBottom: 0, fontSize: 14, color: "#64748b" }}>
            Riwayat aktivitas organisasi. Hanya admin/owner yang bisa melihat.
          </p>
        </div>
        <Link href="/settings" style={btn()}>
          ← Kembali
        </Link>
      </div>

      <section
        style={{
          marginTop: 24,
          padding: "20px 24px",
          background: "#f8fafc",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
        }}
      >
        <h2
          style={{
            margin: "0 0 16px 0",
            fontSize: 13,
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Riwayat aktivitas
        </h2>
        <ActivityFeedClient logs={(logs || []) as any} />
      </section>
    </div>
  );
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "white",
    textDecoration: "none",
    color: "#0f172a",
    fontWeight: 600,
    fontSize: 14,
  };
}