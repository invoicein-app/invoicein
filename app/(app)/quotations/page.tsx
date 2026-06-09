export const runtime = "nodejs";

import { getAppOrg } from "@/lib/auth/get-app-org";
import { supabaseServer } from "@/lib/supabase/server";
import { parseListPageParams } from "@/lib/list-pagination";
import QuotationsListClient, { type QuotationRow } from "./quotations-list-client";

type SearchParams = {
  p?: string;
  ps?: string;
  q?: string;
};

export default async function QuotationsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { page, pageSize, fromIdx, toIdx, totalPages: calcTotalPages } = parseListPageParams(sp);
  const searchQ = String(sp.q || "").trim();

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

  let countQ = supabase
    .from("quotations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.orgId);

  if (searchQ) {
    const like = `%${searchQ}%`;
    countQ = countQ.or(`quotation_number.ilike.${like},customer_name.ilike.${like},status.ilike.${like}`);
  }

  const { count: totalCount, error: countErr } = await countQ;

  if (countErr) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ margin: 0 }}>Quotation</h1>
        <p style={{ marginTop: 8, color: "#b91c1c" }}>{countErr.message}</p>
      </div>
    );
  }

  const totalRows = totalCount || 0;
  const totalPages = calcTotalPages(totalRows);

  let dataQ = supabase
    .from("quotations")
    .select(
      "id,quotation_number,quotation_date,customer_name,subtotal,total,status,invoice_id,is_locked"
    )
    .eq("organization_id", org.orgId)
    .order("quotation_date", { ascending: false })
    .range(fromIdx, toIdx);

  if (searchQ) {
    const like = `%${searchQ}%`;
    dataQ = dataQ.or(`quotation_number.ilike.${like},customer_name.ilike.${like},status.ilike.${like}`);
  }

  const [qRes, invRes] = await Promise.all([
    dataQ,
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
    if ((r as { id?: string }).id) {
      invoiceNoMap[String((r as { id: string }).id)] = String((r as { invoice_number?: string }).invoice_number || "");
    }
  }

  const currentParams = new URLSearchParams();
  if (sp.q) currentParams.set("q", sp.q);
  if (sp.ps) currentParams.set("ps", sp.ps);
  const baseQuery = currentParams.toString();

  return (
    <QuotationsListClient
      rows={((qRes.data || []) as QuotationRow[]) || []}
      invoiceNoMap={invoiceNoMap}
      page={page}
      pageSize={pageSize}
      totalRows={totalRows}
      totalPages={totalPages}
      searchQuery={searchQ}
      baseQuery={baseQuery}
    />
  );
}
