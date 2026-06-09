"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import ListPageLayout from "../components/list-page-layout";
import ListFiltersClient from "../components/list-filters-client";
import PurchaseOrdersListTable, { type PurchaseOrderRow } from "./purchase-orders-list-table";
import { toolbarButtonOutline } from "../components/app-action-buttons";
import { toastError } from "@/lib/app-toast";

export default function PurchaseOrdersListPage() {
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<PurchaseOrderRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [orgId, setOrgId] = useState("");
  const [totalRowsDb, setTotalRowsDb] = useState(0);

  async function load(currentPage = page, currentPageSize = pageSize, search = q) {
    setLoading(true);
    setErr("");
    try {
      let oid = orgId;
      if (!oid) {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes.user;
        if (!user) {
          setRows([]);
          const m = "Unauthorized";
          setErr(m);
          toastError(m);
          return;
        }

        const { data: membership, error: memErr } = await supabase
          .from("memberships")
          .select("org_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (memErr) throw memErr;

        oid = String((membership as { org_id?: string } | null)?.org_id || "");
        if (!oid) {
          setRows([]);
          const m = "Org tidak ditemukan. Pastikan membership aktif.";
          setErr(m);
          toastError(m);
          return;
        }
        setOrgId(oid);
      }

      const fromIdx = (currentPage - 1) * currentPageSize;
      const toIdx = fromIdx + currentPageSize - 1;
      const term = search.trim();

      let countQ = supabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("org_id", oid);

      if (term) {
        const like = `%${term}%`;
        countQ = countQ.or(`po_number.ilike.${like},vendor_name.ilike.${like},status.ilike.${like}`);
      }

      const { count, error: countErr } = await countQ;
      if (countErr) throw countErr;

      const total = count || 0;
      setTotalRowsDb(total);

      let dataQ = supabase
        .from("purchase_orders")
        .select("id,po_number,po_date,vendor_name,total,status")
        .eq("org_id", oid)
        .order("po_date", { ascending: false })
        .range(fromIdx, toIdx);

      if (term) {
        const like = `%${term}%`;
        dataQ = dataQ.or(`po_number.ilike.${like},vendor_name.ilike.${like},status.ilike.${like}`);
      }

      const { data, error } = await dataQ;
      if (error) throw error;
      setRows((data as PurchaseOrderRow[]) || []);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Gagal load purchase orders.";
      setErr(m);
      toastError(m);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(page, pageSize, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const totalRows = totalRowsDb;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const fromIdx = totalRows === 0 ? 0 : (page - 1) * pageSize;
  const toIdx = Math.min(fromIdx + pageSize - 1, Math.max(0, totalRows - 1));

  const clientPagination = useMemo(
    () => ({
      onFirst: () => setPage(1),
      onPrev: () => setPage((p) => Math.max(1, p - 1)),
      onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
      onLast: () => setPage(totalPages),
    }),
    [totalPages]
  );

  const filters = (
    <ListFiltersClient
      searchPlaceholder="Cari PO number / vendor / status..."
      searchValue={q}
      onSearchChange={(v) => {
        setQ(v);
        setPage(1);
        load(1, pageSize, v);
      }}
      onReset={() => {
        setQ("");
        setPage(1);
        load(1, pageSize, "");
      }}
      perPage={pageSize}
      onPerPageChange={(v) => {
        setPageSize(v);
        setPage(1);
      }}
      perPageOptions={[10, 20, 30, 50]}
      hidePerPage
    >
      <button
        type="button"
        onClick={() => load(page, pageSize, q)}
        style={loading ? { ...toolbarButtonOutline(), opacity: 0.6, cursor: "wait" } : toolbarButtonOutline()}
        disabled={loading}
      >
        {loading ? "Loading..." : "Refresh"}
      </button>
    </ListFiltersClient>
  );

  return (
    <>
      {err ? <div style={errBox()}>{err}</div> : null}
      <ListPageLayout
        title="Purchase Order"
        subtitle="List PO yang sudah dibuat."
        primaryLink={{ href: "/purchase-orders/new", label: "+ Buat PO" }}
        secondaryLink={{ href: "/invoice", label: "Invoice" }}
        filters={filters}
        totalRows={totalRows}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        fromIdx={fromIdx}
        toIdx={toIdx}
        clientPagination={clientPagination}
        tableContent={<PurchaseOrdersListTable rows={rows} loading={loading} />}
        listCardTitle="Master Data Purchase Order"
        onPageSizeChange={(v) => {
          setPageSize(v);
          setPage(1);
        }}
      />
    </>
  );
}

function errBox(): React.CSSProperties {
  return {
    margin: "24px 20px 0",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontWeight: 700,
  };
}
