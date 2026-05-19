export const runtime = "nodejs";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OrgSettingsClient from "./org-settings-client";

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
  public_document_code: string;
  invoice_prefix: string;
  po_prefix: string;
  quotation_prefix: string;
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
      <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
        <h2>Kamu belum login</h2>
      </div>
    );
  }

  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return (
      <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
        <h2>Gagal ambil membership</h2>
        <div style={{ marginTop: 8, color: "#666" }}>{memErr.message}</div>
      </div>
    );
  }

  if (!mem?.org_id) {
    return (
      <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
        <h2>No organization found for this user.</h2>
        <div style={{ marginTop: 8, color: "#666" }}>
          User ini belum punya memberships.org_id.
        </div>
      </div>
    );
  }

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
      logo_url,
      public_document_code,
      invoice_prefix,
      po_prefix,
      quotation_prefix
      `
    )
    .eq("id", mem.org_id)
    .single();

  if (orgErr || !org) {
    return (
      <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
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
    public_document_code: org.public_document_code || "",
    invoice_prefix: org.invoice_prefix || "INV",
    po_prefix: org.po_prefix || "PO",
    quotation_prefix: org.quotation_prefix || "QUO",
  };

  return <OrgSettingsClient initial={initial} />;
}
