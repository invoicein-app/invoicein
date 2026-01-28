export const runtime = "nodejs";

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Activity Log</h1>
          <div style={{ marginTop: 6, color: "#64748b" }}>
            Hanya admin/owner yang bisa melihat.
          </div>
        </div>
        <Link href="/settings" style={btn()}>Kembali</Link>
      </div>

      <div style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", background: "white" }}>
        <div style={{ display: "grid", gridTemplateColumns: "180px 120px 220px 1fr", background: "#f8fafc", padding: 12, fontWeight: 900 }}>
          <div>Waktu</div>
          <div>Role</div>
          <div>Action</div>
          <div>Summary</div>
        </div>

        {(logs || []).length === 0 ? (
          <div style={{ padding: 12, color: "#64748b" }}>Belum ada aktivitas.</div>
        ) : (
          logs!.map((l: any) => (
            <div
              key={l.id}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 120px 220px 1fr",
                padding: 12,
                borderTop: "1px solid #e5e7eb",
                gap: 10,
                alignItems: "start",
              }}
            >
              <div style={{ color: "#0f172a", fontWeight: 800 }}>
                {String(l.created_at).replace("T", " ").slice(0, 16)}
              </div>
              <div style={{ color: "#334155" }}>{l.actor_role}</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#0f172a" }}>
                {l.action}
              </div>
              <div style={{ color: "#0f172a" }}>
                <div style={{ fontWeight: 800 }}>{l.summary || "-"}</div>
                {l.meta ? (
                  <pre style={{ marginTop: 6, background: "#f8fafc", border: "1px solid #e5e7eb", padding: 10, borderRadius: 12, fontSize: 12, overflowX: "auto" }}>
                    {JSON.stringify(l.meta, null, 2)}
                  </pre>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "white",
    textDecoration: "none",
    color: "#0f172a",
    fontWeight: 900,
  };
}