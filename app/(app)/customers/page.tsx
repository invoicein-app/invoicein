export const runtime = "nodejs";

import { getAppOrg } from "@/lib/auth/get-app-org";
import { supabaseServer } from "@/lib/supabase/server";
import { parseListPageParams } from "@/lib/list-pagination";
import CustomersListClient, { type CustomerRow } from "./customers-list-client";

type SearchParams = {
  p?: string;
  ps?: string;
  q?: string;
};

export default async function CustomersPage({
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

  let countQ = supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.orgId);

  if (searchQ) {
    const like = `%${searchQ}%`;
    countQ = countQ.or(`name.ilike.${like},phone.ilike.${like},address.ilike.${like}`);
  }

  const { count: totalCount, error: countErr } = await countQ;

  if (countErr) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ margin: 0 }}>Customer</h1>
        <p style={{ marginTop: 8, color: "#b91c1c" }}>{countErr.message}</p>
      </div>
    );
  }

  const totalRows = totalCount || 0;
  const totalPages = calcTotalPages(totalRows);

  let dataQ = supabase
    .from("customers")
    .select("id,name,phone,address,created_at")
    .eq("org_id", org.orgId)
    .order("created_at", { ascending: false })
    .range(fromIdx, toIdx);

  if (searchQ) {
    const like = `%${searchQ}%`;
    dataQ = dataQ.or(`name.ilike.${like},phone.ilike.${like},address.ilike.${like}`);
  }

  const { data, error } = await dataQ;

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ margin: 0 }}>Customer</h1>
        <p style={{ marginTop: 8, color: "#b91c1c" }}>{error.message}</p>
      </div>
    );
  }

  const currentParams = new URLSearchParams();
  if (sp.q) currentParams.set("q", sp.q);
  if (sp.ps) currentParams.set("ps", sp.ps);
  const baseQuery = currentParams.toString();

  return (
    <CustomersListClient
      orgId={org.orgId}
      customers={(data || []) as CustomerRow[]}
      page={page}
      pageSize={pageSize}
      totalRows={totalRows}
      totalPages={totalPages}
      searchQuery={searchQ}
      baseQuery={baseQuery}
    />
  );
}
