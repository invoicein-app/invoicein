export const runtime = "nodejs";

import { getAppOrg } from "@/lib/auth/get-app-org";
import { supabaseServer } from "@/lib/supabase/server";
import QuotationsListClient, { type QuotationRow } from "./quotations-list-client";

export default async function QuotationsListPage() {
  const org = await getAppOrg();

  if (!org.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ margin: 0 }}>Quotation</h1>
        <p style={{ marginTop: 8, color: "#666" }}>
          {org.reason === "unauthorized"
            ? "Kamu belum login."
            : org.message || "Organisasi tidak ditemukan."}
        </p>
      </div>
    );
  }

  const supabase = await supabaseServer();

  const [qRes, invRes] = await Promise.all([
    supabase
      .from("quotations")
      .select(
        "id,quotation_number,quotation_date,customer_name,subtotal,total,status,invoice_id,is_locked"
      )
      .eq("organization_id", org.orgId)
      .order("quotation_date", { ascending: false })
      .limit(200),
    supabase
      .from("invoices")
      .select("id,invoice_number")
      .eq("org_id", org.orgId)
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  if (qRes.error) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ margin: 0 }}>Quotation</h1>
        <p style={{ marginTop: 8, color: "#b91c1c" }}>{qRes.error.message}</p>
      </div>
    );
  }

  const invoiceNoMap: Record<string, string> = {};
  for (const r of invRes.data || []) {
    if ((r as any)?.id) {
      invoiceNoMap[String((r as any).id)] = String((r as any).invoice_number || "");
    }
  }

  return (
    <QuotationsListClient
      orgId={org.orgId}
      initialRows={((qRes.data || []) as QuotationRow[]) || []}
      initialInvoiceNoMap={invoiceNoMap}
    />
  );
}
