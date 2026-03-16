// ✅ REPLACE FULL FILE
// app/settings/page.tsx
// Tambah card "Inventory Settings" (admin only)
// Tetap pertahankan card Invoice Template + PO Settings

"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Role = "admin" | "staff" | null;

export default function SettingsHome() {
  const supabase = supabaseBrowser();

  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<{
    org_code: string;
    subscription_status: string;
    expires_at: string | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes.user;
        if (!user) {
          if (alive) {
            setRole(null);
            setSub(null);
            setLoading(false);
          }
          return;
        }

        const { data: mem } = await supabase
          .from("memberships")
          .select("role, organizations(org_code, subscription_status, expires_at)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (alive) {
          setRole((mem?.role as Role) ?? null);
          const org = (mem as any)?.organizations;
          setSub(
            org
              ? {
                  org_code: org.org_code || "",
                  subscription_status: org.subscription_status || "",
                  expires_at: org.expires_at || null,
                }
              : null
          );
          setLoading(false);
        }
      } catch {
        if (alive) {
          setRole(null);
          setSub(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  const isStaff = role === "staff";
  const isAdmin = role === "admin";

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
    pointerEvents: "none",
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
    <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>Settings</h2>
          <div style={{ color: "#4b5563", marginTop: 6 }}>Pengaturan aplikasi.</div>
        </div>

        <div style={badge}>{loading ? "ROLE: ..." : `ROLE: ${role?.toUpperCase() || "UNKNOWN"}`}</div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {/* Langganan / Kode organisasi */}
        <a href="/settings/subscription" style={{ ...cardBase, color: "inherit" }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>📋 Langganan</div>
          <div style={{ marginTop: 8, color: "#4b5563", fontSize: 13 }}>
            Kode organisasi: <strong style={{ fontFamily: "monospace", letterSpacing: 1 }}>{sub?.org_code || "—"}</strong>
            {sub?.org_code ? (
              <span style={{ marginLeft: 8, fontSize: 12 }}>
                (gunakan saat konfirmasi pembayaran)
              </span>
            ) : null}
          </div>
          {sub?.subscription_status || sub?.expires_at ? (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              Status: <strong>{sub?.subscription_status === "trial" ? "Trial" : sub?.subscription_status === "active" ? "Aktif" : sub?.subscription_status || "—"}</strong>
              {sub?.expires_at ? (
                <span style={{ color: "#6b7280" }}>
                  {" "}• Berakhir: {new Date(sub.expires_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              ) : null}
            </div>
          ) : null}
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
            Perpanjangan manual: transfer lalu kirim bukti + kode org ke admin. Klik untuk detail.
          </div>
        </a>

        {/* Pengaturan Usaha */}
        <a href="/settings/organization" style={cardBase}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>🏪 Pengaturan Usaha</div>
          <div style={{ marginTop: 6, color: "#4b5563", fontSize: 13 }}>
            Logo, alamat, telp, email, rekening, footer invoice.
          </div>
        </a>

        {/* Invoice Template (admin only) */}
        <a
          href="/settings/invoice-template"
          style={!isAdmin ? disabledCard : cardBase}
          title={!isAdmin ? "Hanya Admin yang bisa mengubah template invoice" : "Atur template & opsi PDF"}
          aria-disabled={!isAdmin}
        >
          <div style={{ fontSize: 14, fontWeight: 900 }}>
            🧾 Invoice Template {!isAdmin ? "(Admin only)" : ""}
          </div>
          <div style={{ marginTop: 6, color: "#4b5563", fontSize: 13 }}>
            Pilih template (clean/dotmatrix) + toggle pajak/diskon/surat jalan/terbilang/rekening.
          </div>

          {!isAdmin ? (
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "#b45309" }}>
              Kamu login sebagai <b>STAFF</b>. Menu ini hanya untuk <b>ADMIN</b>.
            </div>
          ) : null}
        </a>

        {/* PO Settings (admin only) */}
        <a
          href="/settings/po"
          style={!isAdmin ? disabledCard : cardBase}
          title={!isAdmin ? "Hanya Admin yang bisa mengubah PO settings" : "Atur tampilan Ship To di PDF PO"}
          aria-disabled={!isAdmin}
        >
          <div style={{ fontSize: 14, fontWeight: 900 }}>
            📦 PO Settings {!isAdmin ? "(Admin only)" : ""}
          </div>
          <div style={{ marginTop: 6, color: "#4b5563", fontSize: 13 }}>
            Toggle tampilkan nama gudang (Ship To) di PDF Purchase Order.
          </div>

          {!isAdmin ? (
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "#b45309" }}>
              Kamu login sebagai <b>STAFF</b>. Menu ini hanya untuk <b>ADMIN</b>.
            </div>
          ) : null}
        </a>

        {/* ✅ Inventory Settings (admin only) */}
        <a
          href="/settings/inventory"
          style={!isAdmin ? disabledCard : cardBase}
          title={
            !isAdmin
              ? "Hanya Admin yang bisa mengubah inventory settings"
              : "Atur trigger stock out, default warehouse, dan stok minus"
          }
          aria-disabled={!isAdmin}
        >
          <div style={{ fontSize: 14, fontWeight: 900 }}>
            📊 Inventory Settings {!isAdmin ? "(Admin only)" : ""}
          </div>
          <div style={{ marginTop: 6, color: "#4b5563", fontSize: 13 }}>
            Atur kapan stok berkurang (Invoice Sent / Surat Jalan), default gudang, dan izin stok minus.
          </div>

          {!isAdmin ? (
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "#b45309" }}>
              Kamu login sebagai <b>STAFF</b>. Menu ini hanya untuk <b>ADMIN</b>.
            </div>
          ) : null}
        </a>

        {/* Manajemen Staff (disabled kalau staff) */}
        <a
          href="/settings/staff"
          style={isStaff ? disabledCard : cardBase}
          title={isStaff ? "Hanya Admin yang bisa mengelola staff" : "Kelola staff"}
          aria-disabled={isStaff}
        >
          <div style={{ fontSize: 14, fontWeight: 900 }}>👥 Manajemen Staff {isStaff ? "(Admin only)" : ""}</div>
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