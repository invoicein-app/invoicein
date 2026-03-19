/**
 * User-facing subscription info: package, status, org_code, expiry, manual renewal instructions.
 * Presentation only; no backend/auth changes.
 */
export const runtime = "nodejs";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import BankInfoCard from "./bank-info-card";
import PaymentConfirmationForm from "./payment-confirmation-form";

export default async function SubscriptionPage() {
  const csAny: any = cookies() as any;
  const cookieStore = csAny?.then ? await csAny : csAny;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: any[]) => {
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
  if (!userRes.user) redirect("/login");

  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id, organizations:organizations(id, name, org_code, subscription_status, subscription_plan, trial_ends_at, expires_at)")
    .eq("user_id", userRes.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const org = (mem as any)?.organizations;
  if (!org) redirect("/settings");

  const status = String(org.subscription_status || "").toLowerCase();
  const plan = String(org.subscription_plan || "basic").toLowerCase();
  const isBronze = plan !== "standard";
  const planDisplayName = isBronze ? "Bronze (Basic)" : "Silver (Standard)";
  const statusLabel =
    status === "trial" ? "Trial" :
    status === "active" ? "Aktif" :
    status === "expired" ? "Kadaluarsa" :
    status === "cancelled" ? "Dibatalkan" :
    status === "grace_period" ? "Grace period" :
    status || "—";

  const expiresAt = org.expires_at ? new Date(org.expires_at) : null;
  const trialEndsAt = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const now = new Date();
  const isExpired = expiresAt ? expiresAt <= now : false;

  const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: 1, marginBottom: 12 };
  const card: React.CSSProperties = {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 20,
    background: "white",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 32px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Langganan</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
          Status paket, rekening pembayaran, dan cara perpanjang.
        </p>
      </div>

      {/* Ringkasan: org + status + paket + expiry dalam satu blok terstruktur */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={sectionTitle}>RINGKASAN LANGGANAN</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Organisasi</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{org.name || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Kode organisasi (org_code)</div>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 16, fontWeight: 800, letterSpacing: 2, color: "#0f172a" }}>
              {org.org_code || "—"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Sertakan kode ini saat kirim bukti transfer</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Paket saat ini</div>
            <div>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  background: isBronze ? "#fef3c7" : "#e0e7ff",
                  color: isBronze ? "#92400e" : "#3730a3",
                }}
              >
                {planDisplayName}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Status</div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: isExpired ? "#b91c1c" : status === "trial" ? "#0d9488" : "#0f172a",
              }}
            >
              {statusLabel}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Aktif sampai</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
              {expiresAt
                ? expiresAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                : "—"}
            </div>
            {trialEndsAt && status === "trial" && (
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                Trial berakhir: {trialEndsAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Paket & fitur: Bronze vs Silver */}
      <div style={sectionTitle}>PAKET & FITUR</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div
          style={{
            ...card,
            flex: "1 1 240px",
            minWidth: 0,
            borderColor: isBronze ? "#f59e0b" : "#e2e8f0",
            borderWidth: isBronze ? 2 : 1,
            background: isBronze ? "#fffbeb" : "white",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Bronze (Basic)</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>1 staff aktif</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Pembayaran manual via transfer bank</div>
          {isBronze && (
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "#b45309" }}>Paket Anda saat ini</div>
          )}
        </div>
        <div
          style={{
            ...card,
            flex: "1 1 240px",
            minWidth: 0,
            borderColor: !isBronze ? "#6366f1" : "#e2e8f0",
            borderWidth: !isBronze ? 2 : 1,
            background: !isBronze ? "#eef2ff" : "white",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Silver (Standard)</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>Hingga 3 staff aktif</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Pembayaran manual via transfer bank</div>
          {!isBronze && (
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "#4f46e5" }}>Paket Anda saat ini</div>
          )}
        </div>
      </div>

      {/* Rekening: highlight */}
      <div style={sectionTitle}>REKENING PEMBAYARAN</div>
      <div style={{ marginBottom: 24 }}>
        <BankInfoCard />
      </div>

      {/* Form konfirmasi pembayaran */}
      <div style={sectionTitle}>KONFIRMASI PEMBAYARAN</div>
      <PaymentConfirmationForm orgId={org.id} orgName={org.name} orgCode={org.org_code} />

      {/* CTA: langkah perpanjang / upgrade */}
      <div style={{ ...card, background: "#f0fdf4", borderColor: "#bbf7d0" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>
          Cara perpanjang atau upgrade
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, color: "#166534", fontSize: 14, lineHeight: 2 }}>
          <li><strong>Transfer</strong> ke rekening BCA di atas sesuai paket yang Anda pilih (Bronze atau Silver).</li>
          <li><strong>Kirim bukti transfer</strong> dan <strong>kode organisasi ({org.org_code})</strong> ke admin via WhatsApp.</li>
          <li><strong>Admin akan memverifikasi</strong> dan mengaktifkan perpanjangan atau upgrade dalam waktu kerja.</li>
        </ol>
        <p style={{ margin: "14px 0 0", padding: "12px 14px", background: "white", borderRadius: 10, border: "1px solid #bbf7d0", fontSize: 14 }}>
          <span style={{ color: "#64748b" }}>Konfirmasi pembayaran:</span>{" "}
          <a
            href="https://wa.me/6281252832053"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#0d9488", fontWeight: 700, textDecoration: "none" }}
          >
            WhatsApp 081252832053
          </a>
        </p>
        <p style={{ margin: "16px 0 0", fontSize: 13, color: "#15803d" }}>
          Setelah kadaluarsa, Anda tetap bisa login dan melihat data. Pembuatan atau perubahan transaksi akan diblokir sampai langganan diperpanjang.
        </p>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link
          href="/settings"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            background: "white",
            color: "#334155",
            fontWeight: 700,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          ← Kembali ke Pengaturan
        </Link>
      </div>
    </div>
  );
}
