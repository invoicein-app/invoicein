export const runtime = "nodejs";

import { getAppOrg } from "@/lib/auth/get-app-org";
import { supabaseServer } from "@/lib/supabase/server";
import ProductsListClient from "./products-list-client";
import type { ProductRow } from "./product-form";

export default async function ProductsPage() {
  const org = await getAppOrg();

  if (!org.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ margin: 0 }}>Barang</h1>
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
    .from("products")
    .select("id,name,sku,unit,price,is_active,created_at")
    .eq("org_id", org.orgId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ margin: 0 }}>Barang</h1>
        <p style={{ marginTop: 8, color: "#b91c1c" }}>{error.message}</p>
      </div>
    );
  }

  return (
    <ProductsListClient orgId={org.orgId} initialRows={(data || []) as ProductRow[]} />
  );
}
