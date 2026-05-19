// app/(app)/settings/page.tsx — Daftar pengaturan aplikasi (UI referensi)
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Role = "admin" | "staff" | null;

type IconKind = "briefcase" | "invoice" | "box" | "chart" | "users" | "clipboard";

const TEAL = "#1D7A73";
const BG = "#F8F9FA";
const CARD_BORDER = "#e5e7eb";

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

  const disabledCard: React.CSSProperties = {
    opacity: 0.55,
    cursor: "not-allowed",
    pointerEvents: "none",
    background: "#f3f4f6",
  };

  type CardDef = {
    href: string;
    title: string;
    desc: string;
    adminOnly?: boolean;
    staffBlocked?: boolean;
    icon: IconKind;
  };

  const cards: CardDef[] = [
    {
      href: "/settings/subscription",
      title: "Langganan",
      desc: "Kode organisasi, status langganan, dan perpanjangan manual.",
      icon: "clipboard",
    },
    {
      href: "/settings/organization",
      title: "Pengaturan Usaha",
      desc: "Logo, Alamat, Telp, Email, Rekening, Footer Invoice",
      icon: "briefcase",
    },
    {
      href: "/settings/invoice-template",
      title: "Invoice Template",
      desc: "Pilih template (clean/dotmatrix) + opsi pajak, diskon, surat jalan, terbilang.",
      adminOnly: true,
      icon: "invoice",
    },
    {
      href: "/settings/po",
      title: "PO Settings",
      desc: "Tampilkan nama gudang (Ship To) di PDF Purchase Order.",
      adminOnly: true,
      icon: "box",
    },
    {
      href: "/settings/inventory",
      title: "Inventory Settings",
      desc: "Trigger stok keluar, default gudang, dan izin stok minus.",
      adminOnly: true,
      icon: "chart",
    },
    {
      href: "/settings/staff",
      title: "Manajemen Staff",
      desc: "Tambah staff, reset password, dan nonaktifkan staff.",
      staffBlocked: true,
      icon: "users",
    },
  ];

  return (
    <div style={{ width: "100%", padding: "16px 20px 32px", boxSizing: "border-box", background: BG, minHeight: "100%" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#333" }}>Pengaturan</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/settings/activity"
            title="Notifikasi / aktivitas"
            style={iconCircle()}
          >
            <BellIcon />
          </Link>
          <Link href="/settings" title="Profil & pengaturan" style={iconCircle()}>
            <UserIcon />
          </Link>
        </div>
      </div>

      <p style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 800, color: "#333" }}>Pengaturan Aplikasi</p>

      {loading ? (
        <div style={{ color: "#999", fontSize: 14 }}>Memuat…</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {cards.map((c) => {
            const blocked = (c.adminOnly && !isAdmin) || (c.staffBlocked && isStaff);
            const cardInner = (
              <>
                <div style={{ width: 48, height: 48, flexShrink: 0, display: "grid", placeItems: "center" }}>
                  <SettingIcon kind={c.icon} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#333" }}>{c.title}</div>
                  <div style={{ marginTop: 6, fontSize: 14, color: "#777", lineHeight: 1.45 }}>
                    {c.href === "/settings/subscription" && sub?.org_code ? (
                      <>
                        <span>
                          Kode org: <strong style={{ fontFamily: "monospace" }}>{sub.org_code}</strong>
                        </span>
                        {sub.subscription_status || sub.expires_at ? (
                          <span style={{ display: "block", marginTop: 6 }}>
                            Status: <strong>{sub.subscription_status || "—"}</strong>
                            {sub.expires_at
                              ? ` • Berakhir: ${new Date(sub.expires_at).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}`
                              : null}
                          </span>
                        ) : null}
                        <span style={{ display: "block", marginTop: 8 }}>{c.desc}</span>
                      </>
                    ) : (
                      c.desc
                    )}
                  </div>
                  {c.adminOnly && !isAdmin ? (
                    <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "#b45309" }}>
                      Hanya <b>ADMIN</b>.
                    </div>
                  ) : null}
                  {c.staffBlocked && isStaff ? (
                    <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "#b45309" }}>
                      Hanya <b>ADMIN</b>.
                    </div>
                  ) : null}
                </div>
                <div style={{ flexShrink: 0, color: TEAL, display: "grid", placeItems: "center" }}>
                  <ChevronRightIcon />
                </div>
              </>
            );

            const baseStyle: React.CSSProperties = {
              ...cardStyle(),
              textDecoration: "none",
              color: "inherit",
            };

            if (blocked) {
              return (
                <div key={c.href} style={{ ...baseStyle, ...disabledCard }}>
                  {cardInner}
                </div>
              );
            }

            return (
              <Link key={c.href} href={c.href} style={baseStyle}>
                {cardInner}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function cardStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "20px 20px",
    borderRadius: 8,
    border: `1px solid ${CARD_BORDER}`,
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    boxSizing: "border-box",
  };
}

function iconCircle(): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(29, 122, 115, 0.12)",
    display: "grid",
    placeItems: "center",
    textDecoration: "none",
    border: "1px solid rgba(29, 122, 115, 0.2)",
  };
}

function BellIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 18l6-6-6-6" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingIcon({ kind }: { kind: IconKind }) {
  const common = { width: 40, height: 40, viewBox: "0 0 24 24" as const, fill: "none" as const };
  switch (kind) {
    case "briefcase":
      return (
        <svg {...common}>
          <rect x="4" y="8" width="16" height="11" rx="2" stroke="#8d6e63" strokeWidth="1.6" />
          <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="#8d6e63" strokeWidth="1.6" />
        </svg>
      );
    case "invoice":
      return (
        <svg {...common}>
          <path d="M7 4h10v16H7V4z" stroke={TEAL} strokeWidth="1.6" />
          <path d="M9 9h6M9 13h4" stroke={TEAL} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "box":
      return (
        <svg {...common}>
          <path d="M12 3l8 4v10l-8 4-8-4V7l8-4z" stroke={TEAL} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M12 12l8-4M12 12v10M12 12L4 8" stroke={TEAL} strokeWidth="1.4" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16" stroke={TEAL} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M7 15v-4M12 15V9M17 15v-7" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="3" stroke={TEAL} strokeWidth="1.5" />
          <circle cx="16" cy="10" r="2.5" stroke={TEAL} strokeWidth="1.5" />
          <path d="M3 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" stroke={TEAL} strokeWidth="1.4" />
        </svg>
      );
    case "clipboard":
    default:
      return (
        <svg {...common}>
          <path d="M9 4h6l1 2h3a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1h3l1-2z" stroke={TEAL} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 12h6M9 16h4" stroke={TEAL} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
  }
}
