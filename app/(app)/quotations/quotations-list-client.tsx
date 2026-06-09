"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ListPageLayout from "../components/list-page-layout";
import ListFiltersClient from "../components/list-filters-client";
import QuotationsListTable from "./quotations-list-table";
import { toolbarButtonOutline } from "../components/app-action-buttons";
import { toastError, toastSuccess } from "@/lib/app-toast";
import { buildListPageQuery } from "@/lib/list-pagination";

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

type Props = {
  rows: QuotationRow[];
  invoiceNoMap: Record<string, string>;
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  searchQuery: string;
  baseQuery: string;
};

export default function QuotationsListClient({
  rows,
  invoiceNoMap,
  page,
  pageSize,
  totalRows,
  totalPages,
  searchQuery,
  baseQuery,
}: Props) {
  const router = useRouter();
  const [convertingId, setConvertingId] = useState("");

  const fromIdx = totalRows === 0 ? 0 : (page - 1) * pageSize;
  const toIdx = Math.min(fromIdx + pageSize - 1, Math.max(0, totalRows - 1));

  function pushQuery(patch: Record<string, string>) {
    const qs = buildListPageQuery(
      Object.fromEntries(new URLSearchParams(baseQuery).entries()),
      patch
    );
    router.push(qs ? `/quotations?${qs}` : "/quotations");
  }

  async function convertToInvoice(id: string) {
    const row = rows.find((x) => x.id === id);
    if (!row) return;

    if (row.invoice_id) {
      router.push(`/invoice/${row.invoice_id}`);
      return;
    }

    if (row.is_locked) {
      toastError("Quotation ini sudah locked, tidak bisa di-convert.");
      return;
    }

    const ok = confirm("Convert quotation ini menjadi Invoice? (Quotation akan dikunci)");
    if (!ok) return;

    setConvertingId(id);
    try {
      const res = await fetch(`/api/quotations/convert/${id}`, { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json?.error || "Gagal convert quotation.");

      toastSuccess("Quotation berhasil di-convert.");

      const invoiceId = String(json?.invoice_id || "");
      if (invoiceId) {
        router.push(`/invoice/${invoiceId}`);
        return;
      }

      const quotationId = String(json?.quotation_id || id);
      if (json?.prefill) {
        router.push(`/invoice/new?fromQuotationId=${encodeURIComponent(quotationId)}`);
        return;
      }

      throw new Error("Response convert tidak dikenali (tidak ada invoice_id / prefill).");
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : "Gagal convert.");
    } finally {
      setConvertingId("");
    }
  }

  const clientPagination = {
    onFirst: () => pushQuery({ p: "1" }),
    onPrev: () => pushQuery({ p: String(Math.max(1, page - 1)) }),
    onNext: () => pushQuery({ p: String(Math.min(totalPages, page + 1)) }),
    onLast: () => pushQuery({ p: String(totalPages) }),
  };

  const filters = (
    <ListFiltersClient
      searchPlaceholder="Cari quotation number / customer / status..."
      searchValue={searchQuery}
      onSearchChange={(v) => {
        const patch: Record<string, string> = { p: "1" };
        patch.q = v.trim();
        pushQuery(patch);
      }}
      onReset={() => pushQuery({ q: "", p: "1" })}
      perPage={pageSize}
      onPerPageChange={(v) => pushQuery({ ps: String(v), p: "1" })}
      perPageOptions={[10, 20, 30, 50]}
      hidePerPage
    >
      <button
        type="button"
        onClick={() => router.refresh()}
        style={toolbarButtonOutline()}
      >
        Refresh
      </button>
    </ListFiltersClient>
  );

  return (
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
          rows={rows}
          loading={false}
          invoiceNoMap={invoiceNoMap}
          convertingId={convertingId}
          onConvert={convertToInvoice}
        />
      }
      listCardTitle="Master Data Penawaran"
      onPageSizeChange={(v) => pushQuery({ ps: String(v), p: "1" })}
    />
  );
}
