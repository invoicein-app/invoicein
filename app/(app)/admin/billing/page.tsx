/**
 * Billing admin: search org by org_code, view/update package and expiry.
 * Access gated via lib/billing-admin (MVP: env allowlist; future: role-based).
 */
export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getBillingAdminAuth } from "@/lib/billing-admin";
import AdminBillingClient from "./admin-billing-client";

export default async function AdminBillingPage() {
  const csAny: any = cookies() as any;
  const cookieStore = csAny?.then ? await csAny : csAny;
  const auth = await getBillingAdminAuth(cookieStore);
  if (!auth.ok) redirect(auth.status === 401 ? "/login" : "/dashboard");

  return (
    <div style={{ maxWidth: 720, padding: "0 8px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Billing Admin</h1>
        <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14 }}>
          Cari organisasi berdasarkan org_code. Perpanjang atau ubah paket setelah verifikasi pembayaran manual.
        </p>
      </div>
      <AdminBillingClient />
    </div>
  );
}
