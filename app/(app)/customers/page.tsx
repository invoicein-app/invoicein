export const runtime = "nodejs";

import { getAppOrg } from "@/lib/auth/get-app-org";
import { supabaseServer } from "@/lib/supabase/server";
import CustomersListClient, { type CustomerRow } from "./customers-list-client";

export default async function CustomersPage() {
  const org = await getAppOrg();

  if (!org.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ margin: 0 }}>Customer</h1>
        <p style={{ marginTop: 8, color: "#666" }}>
          {org.reason === "unauthorized"
            ? "Kamu belum login."
            : org.message || "Organisasi tidak ditemukan."}
        </p>
      </div>
    );
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone,address,created_at")
    .eq("org_id", org.orgId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ margin: 0 }}>Customer</h1>
        <p style={{ marginTop: 8, color: "#b91c1c" }}>{error.message}</p>
      </div>
    );
  }

  return (
    <CustomersListClient
      orgId={org.orgId}
      initialCustomers={(data || []) as CustomerRow[]}
    />
  );
}
