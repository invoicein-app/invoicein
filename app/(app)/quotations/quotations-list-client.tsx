"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import ListPageLayout from "../components/list-page-layout";
import ListFiltersClient from "../components/list-filters-client";
import QuotationsListTable from "./quotations-list-table";
import { toolbarButtonOutline } from "../components/app-action-buttons";

export type QuotationRow = {
  id: string;
  quotation_number: string | null;
  quotation_date: string | null;
  customer_name: string | null;
  subtotal: number | null;
  total: number | null;
  status: string | null;
  invoice_id: string | null;
  is_locked: boolean | null;
};

export default function QuotationsListClient({
  orgId,
  initialRows,
  initialInvoiceNoMap,
}: {
  orgId: string;
  initialRows: QuotationRow[];
  initialInvoiceNoMap: Record<string, string>;
}) {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<QuotationRow[]>(initialRows);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [convertingId, setConvertingId] = useState<string>("");
  const [invoiceNoMap, setInvoiceNoMap] = useState<Record<string, string>>(initialInvoiceNoMap);

  async function refreshList() {
    setRefreshing(true);
    setErr("");
    try {
      const [qRes, invRes] = await Promise.all([
        supabase
          .from("quotations")
          .select(
            "id,quotation_number,quotation_date,customer_name,subtotal,total,status,invoice_id,is_locked"
          )
          .eq("organization_id", orgId)
          .order("quotation_date", { ascending: false })
          .limit(200),
        supabase
          .from("invoices")
          .select("id,invoice_number")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(400),
      ]);

      if (qRes.error) throw qRes.error;

      setRows(((qRes.data as QuotationRow[]) || []) as QuotationRow[]);

      const map: Record<string, string> = {};
      for (const r of (invRes.data || []) as { id?: string; invoice_number?: string }[]) {
        if (r?.id) map[String(r.id)] = String(r.invoice_number || "");
      }
      setInvoiceNoMap(map);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal load quotations.");
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const blob = `${r.quotation_number || ""} ${r.customer_name || ""} ${r.status || ""}`.toLowerCase();
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

  async function convertToInvoice(id: string) {
    const row = rows.find((x) => x.id === id);
    if (!row) return;

    if (row.invoice_id) {
      router.push(`/invoice/${row.invoice_id}`);
      return;
    }

    if (row.is_locked) {
      alert("Quotation ini sudah locked, tidak bisa di-convert.");
      return;
    }

    const ok = confirm("Convert quotation ini menjadi Invoice? (Quotation akan dikunci)");
    if (!ok) return;

    setConvertingId(id);
    try {
      const res = await fetch(`/api/quotations/convert/${id}`, { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json?.error || "Gagal convert quotation.");

      const invoiceId = String(json?.invoice_id || "");
      if (invoiceId) {
        await refreshList();
        router.push(`/invoice/${invoiceId}`);
        return;
      }

      const quotationId = String(json?.quotation_id || id);
      if (json?.prefill) {
        await refreshList();
        router.push(`/invoice/new?fromQuotationId=${encodeURIComponent(quotationId)}`);
        return;
      }

      throw new Error("Response convert tidak dikenali (tidak ada invoice_id / prefill).");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Gagal convert.");
    } finally {
      setConvertingId("");
    }
  }

  const filters = (
    <ListFiltersClient
      searchPlaceholder="Cari quotation number / customer / status..."
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
        onClick={refreshList}
        style={refreshing ? { ...toolbarButtonOutline(), opacity: 0.6, cursor: "wait" } : toolbarButtonOutline()}
        disabled={refreshing}
      >
        {refreshing ? "Memperbarui..." : "Refresh"}
      </button>
    </ListFiltersClient>
  );

  return (
    <>
      {err ? <div style={errBox()}>{err}</div> : null}
      <ListPageLayout
        title="Quotation"
        subtitle="List quotation yang bisa di-convert jadi invoice."
        primaryLink={{ href: "/quotations/new", label: "+ Buat Quotation" }}
        secondaryLink={{ href: "/invoice", label: "Invoice" }}
        filters={filters}
        totalRows={totalRows}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        fromIdx={fromIdx}
        toIdx={toIdx}
        clientPagination={clientPagination}
        tableContent={
          <QuotationsListTable
            rows={paginated}
            loading={refreshing}
            invoiceNoMap={invoiceNoMap}
            convertingId={convertingId}
            onConvert={convertToInvoice}
          />
        }
        listCardTitle="Master Data Penawaran"
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
