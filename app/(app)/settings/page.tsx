// app/settings/page.tsx  (atau file SettingsHome kamu berada)
// ✅ Disable menu "Manajemen Staff" kalau role = staff

"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Role = "admin" | "staff" | null;

export default function SettingsHome() {
  const supabase = supabaseBrowser();

  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // 1) ambil user
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes.user;
        if (!user) {
          if (alive) {
            setRole(null);
            setLoading(false);
          }
          return;
        }

        // 2) ambil role dari memberships (org pertama)
        const { data: mem } = await supabase
          .from("memberships")
          .select("role")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (alive) {
          setRole((mem?.role as Role) ?? null);
          setLoading(false);
        }
      } catch {
        if (alive) {
          setRole(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  const isStaff = role === "staff";

  const cardBase: React.CSSProperties = {
    display: "block",
    padding: 16,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    textDecoration: "none",
    color: "#111",
    background: "white",
  };

  const disabledCard: React.CSSProperties = {
    ...cardBase,
    opacity: 0.55,
    cursor: "not-allowed",
    pointerEvents: "none", // biar gak bisa diklik
    background: "#f9fafb",
  };

  const badge: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 900,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    color: "#111",
    background: "#fff",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>Settings</h2>
          <div style={{ color: "#4b5563", marginTop: 6 }}>Pengaturan aplikasi.</div>
        </div>

        <div style={badge}>
          {loading ? "ROLE: ..." : `ROLE: ${role?.toUpperCase() || "UNKNOWN"}`}
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {/* Pengaturan Usaha */}
        <a href="/settings/organization" style={cardBase}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>🏪 Pengaturan Usaha</div>
          <div style={{ marginTop: 6, color: "#4b5563", fontSize: 13 }}>
            Logo, alamat, telp, email, rekening, footer invoice.
          </div>
        </a>

        {/* Manajemen Staff (disabled kalau staff) */}
        <a
          href="/settings/staff"
          style={isStaff ? disabledCard : cardBase}
          title={isStaff ? "Hanya Admin yang bisa mengelola staff" : "Kelola staff"}
          aria-disabled={isStaff}
        >
          <div style={{ fontSize: 14, fontWeight: 900 }}>
            👥 Manajemen Staff {isStaff ? "(Admin only)" : ""}
          </div>
          <div style={{ marginTop: 6, color: "#4b5563", fontSize: 13 }}>
            Tambah staff, reset password, nonaktifkan staff.
          </div>

          {isStaff ? (
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "#b45309" }}>
              Kamu login sebagai <b>STAFF</b>. Menu ini hanya untuk <b>ADMIN</b>.
            </div>
          ) : null}
        </a>
      </div>
    </div>
  );
}