export const runtime = "nodejs";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OrgSettingsClient from "./org-settings-client";
import OrgLogoClient from "./org-logo-client";

type OrgForm = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_account: string;
  bank_account_name: string;
  invoice_footer: string;
  logo_url?: string;
};

export default async function OrganizationSettingsPage() {
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

  if (!user) {
    return (
      <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
        <h2>Kamu belum login</h2>
      </div>
    );
  }

  // cari org dari memberships
  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return (
      <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
        <h2>Gagal ambil membership</h2>
        <div style={{ marginTop: 8, color: "#666" }}>{memErr.message}</div>
      </div>
    );
  }

  if (!mem?.org_id) {
    return (
      <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
        <h2>No organization found for this user.</h2>
        <div style={{ marginTop: 8, color: "#666" }}>
          User ini belum punya memberships.org_id.
        </div>
      </div>
    );
  }

  // Ambil org profile (PENTING: jangan select kolom yang belum ada, misal logo_url)
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select(
      `
      id,
      name,
      address,
      phone,
      email,
      bank_name,
      bank_account,
      bank_account_name,
      invoice_footer,
      logo_url
      `
    )
    .eq("id", mem.org_id)
    .single();

  if (orgErr || !org) {
    return (
      <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
        <h2>Gagal ambil data organisasi</h2>
        <div style={{ marginTop: 8, color: "#666" }}>{orgErr?.message}</div>
      </div>
    );
  }

  const initial: OrgForm = {
    id: org.id,
    name: org.name || "",
    address: org.address || "",
    phone: org.phone || "",
    email: org.email || "",
    bank_name: org.bank_name || "",
    bank_account: org.bank_account || "",
    bank_account_name: org.bank_account_name || "",
    invoice_footer: org.invoice_footer || "",
    logo_url: org.logo_url || "",
  };

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <h2 style={{ margin: 0 }}>Pengaturan Organisasi</h2>
      <div style={{ color: "#666", marginTop: 6 }}>
        Update identitas usaha untuk header invoice & surat jalan.
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {/* Logo (opsional) */}
      <OrgLogoClient currentUrl={initial.logo_url || ""} />
        {/* Form utama */}
        <OrgSettingsClient initial={initial} />
      </div>
    </div>
  );
}