"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import ListPageLayout from "../components/list-page-layout";
import ListFiltersClient from "../components/list-filters-client";
import PurchaseOrdersListTable, { type PurchaseOrderRow } from "./purchase-orders-list-table";
import { toolbarButtonOutline } from "../components/app-action-buttons";

export default function PurchaseOrdersListPage() {
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<PurchaseOrderRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        setRows([]);
        setErr("Unauthorized");
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

      const orgId = String((membership as any)?.org_id || "");
      if (!orgId) {
        setRows([]);
        setErr("Org tidak ditemukan. Pastikan membership aktif.");
        return;
      }

      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id,po_number,po_date,vendor_name,total,status")
        .eq("org_id", orgId)
        .order("po_date", { ascending: false })
        .limit(200);

      if (error) throw error;
      setRows((data as PurchaseOrderRow[]) || []);
    } catch (e: any) {
      setErr(e?.message || "Gagal load purchase orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const blob = `${r.po_number || ""} ${r.vendor_name || ""} ${r.status || ""}`.toLowerCase();
      return blob.includes(s);
    });
  }, [rows, q]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  const paginated = useMemo(() => filtered.slice(fromIdx, fromIdx + pageSize), [filtered, fromIdx, pageSize]);

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
      onSearchChange={setQ}
      onReset={() => {
        setQ("");
        setPage(1);
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
        onClick={load}
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
        tableContent={<PurchaseOrdersListTable rows={paginated} loading={loading} />}
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
