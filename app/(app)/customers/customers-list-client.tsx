"use client";

import { useState } from "react";
import { useAppRouter } from "@/app/components/use-app-router";
import { supabaseBrowser } from "@/lib/supabase/client";
import ListPageLayout from "../components/list-page-layout";
import ListFiltersClient from "../components/list-filters-client";
import TableEmptyState from "../components/table-empty-state";
import { ul } from "../components/unified-list-table";
import {
  formPrimaryButton,
  tableActionDanger,
  tableActionSecondary,
} from "../components/app-action-buttons";
import FormSubmitButton from "../components/form-submit-button";
import { useSubmitGuard } from "../components/use-submit-guard";
import CustomersImportPanel from "./customers-import-panel";
import { toastError, toastSuccess } from "@/lib/app-toast";
import { buildListPageQuery } from "@/lib/list-pagination";

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  created_at?: string | null;
};

type CustomerForm = {
  name: string;
  phone: string;
  address: string;
};

type Props = {
  orgId: string;
  customers: CustomerRow[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  searchQuery: string;
  baseQuery: string;
};

export default function CustomersListClient({
  orgId,
  customers,
  page,
  pageSize,
  totalRows,
  totalPages,
  searchQuery,
  baseQuery,
}: Props) {
  const router = useAppRouter();
  const supabase = supabaseBrowser();

  const [msg, setMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<CustomerForm>({ name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const { tryBegin, end, isBlocked } = useSubmitGuard(setSaving);

  const fromIdx = totalRows === 0 ? 0 : (page - 1) * pageSize;
  const toIdx = Math.min(fromIdx + pageSize - 1, Math.max(0, totalRows - 1));

  function pushQuery(patch: Record<string, string>) {
    const qs = buildListPageQuery(
      Object.fromEntries(new URLSearchParams(baseQuery).entries()),
      patch
    );
    router.push(qs ? `/customers?${qs}` : "/customers");
  }

  async function refreshList() {
    setRefreshing(true);
    try {
      router.refresh();
    } finally {
      setRefreshing(false);
    }
  }

  function openCreate() {
    setMode("create");
    setEditingId("");
    setForm({ name: "", phone: "", address: "" });
    setSheetOpen(true);
  }

  function openEdit(row: CustomerRow) {
    setMode("edit");
    setEditingId(row.id);
    setForm({ name: row.name || "", phone: row.phone || "", address: row.address || "" });
    setSheetOpen(true);
  }

  async function saveCustomer() {
    if (isBlocked()) return;
    setMsg("");
    if (!form.name.trim()) {
      const m = "Nama customer wajib diisi.";
      setMsg(m);
      toastError(m);
      return;
    }
    if (!tryBegin()) return;
    try {
      if (mode === "create") {
        const { error } = await supabase.from("customers").insert({
          org_id: orgId,
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
        });
        if (error) {
          setMsg(error.message);
          toastError(error.message);
          return;
        }
        toastSuccess("Customer berhasil ditambahkan.");
      } else {
        const { error } = await supabase
          .from("customers")
          .update({
            name: form.name.trim(),
            phone: form.phone.trim(),
            address: form.address.trim(),
          })
          .eq("id", editingId);
        if (error) {
          setMsg(error.message);
          toastError(error.message);
          return;
        }
        toastSuccess("Customer berhasil diperbarui.");
      }
      setSheetOpen(false);
      await refreshList();
    } finally {
      end();
    }
  }

  async function deleteCustomer(id: string) {
    setMsg("");
    if (!confirm("Hapus customer ini?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) {
      setMsg(error.message);
      toastError(error.message);
      return;
    }
    toastSuccess("Customer berhasil dihapus.");
    await refreshList();
  }

  const clientPagination = {
    onFirst: () => pushQuery({ p: "1" }),
    onPrev: () => pushQuery({ p: String(Math.max(1, page - 1)) }),
    onNext: () => pushQuery({ p: String(Math.min(totalPages, page + 1)) }),
    onLast: () => pushQuery({ p: String(totalPages) }),
  };

  const filters = (
    <ListFiltersClient
      searchPlaceholder="Cari nama / telp / alamat..."
      searchValue={searchQuery}
      onSearchChange={(v) => pushQuery({ q: v.trim(), p: "1" })}
      onReset={() => pushQuery({ q: "", p: "1" })}
      perPage={pageSize}
      onPerPageChange={(v) => pushQuery({ ps: String(v), p: "1" })}
      perPageOptions={[10, 20, 30, 50]}
      hidePerPage
    >
      <a href="/customers/pricelist" style={tableActionSecondary()}>
        Daftar Harga Customer
      </a>
      <button type="button" onClick={() => setImportOpen(true)} style={tableActionSecondary()}>
        Import Paper.id
      </button>
      <button type="button" onClick={openCreate} style={formPrimaryButton()}>
        + Tambah Customer
      </button>
    </ListFiltersClient>
  );

  const tableContent = (
    <div className={ul.scroll}>
      <table className={`${ul.table} app-table--customers`} style={{ minWidth: 640 }}>
        <thead>
          <tr>
            <th className={ul.th}>Nama</th>
            <th className={ul.th}>Alamat</th>
            <th className={ul.th}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {refreshing ? (
            <tr>
              <td colSpan={3} className={ul.loading}>
                Memperbarui…
              </td>
            </tr>
          ) : customers.length === 0 ? (
            <TableEmptyState colSpan={3} message="Belum ada customer." />
          ) : (
            customers.map((c) => (
              <tr key={c.id}>
                <td className={ul.tdTop}>
                  <span className={ul.primaryText}>{c.name}</span>
                  {c.phone ? <div className={ul.primaryMeta}>HP: {c.phone}</div> : null}
                </td>
                <td className={ul.td}>
                  <span style={{ whiteSpace: "pre-wrap" }}>{c.address || "-"}</span>
                </td>
                <td className={`${ul.td} app-td-actions`}>
                  <div className={ul.actions}>
                    <button type="button" onClick={() => openEdit(c)} style={tableActionSecondary()}>
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteCustomer(c.id)} style={tableActionDanger()}>
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <ListPageLayout
        title="Customer"
        subtitle="Kelola data pelanggan untuk invoice"
        secondaryLink={{ href: "/invoice", label: "Invoice" }}
        filters={filters}
        totalRows={totalRows}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        fromIdx={fromIdx}
        toIdx={toIdx}
        clientPagination={clientPagination}
        tableContent={tableContent}
        listCardTitle="Master Data Customer"
        onPageSizeChange={(v) => pushQuery({ ps: String(v), p: "1" })}
      />

      {msg ? (
        <div style={{ marginTop: 12, padding: 24, width: "100%", boxSizing: "border-box" }}>
          <div style={alert()}>
            <b>Ada masalah:</b> {msg}
          </div>
        </div>
      ) : null}

      <CustomersImportPanel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={refreshList}
      />

      {sheetOpen ? (
        <div style={backdrop()}>
          <div style={sheet()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0 }}>{mode === "create" ? "Tambah Customer" : "Edit Customer"}</h3>
                <p style={{ marginTop: 6, color: "#666" }}>Data ini dipakai untuk invoice & surat jalan</p>
              </div>
              <button type="button" onClick={() => setSheetOpen(false)} disabled={saving} style={tableActionSecondary()}>
                Tutup
              </button>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label style={label()}>
                Nama
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input()} />
              </label>
              <label style={label()}>
                No HP
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={input()} />
              </label>
              <label style={label()}>
                Alamat
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  style={{ ...input(), minHeight: 90 }}
                />
              </label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setSheetOpen(false)} disabled={saving} style={tableActionSecondary()}>
                  Batal
                </button>
                <FormSubmitButton busy={saving} busyLabel="Menyimpan..." onClick={saveCustomer}>
                  Simpan
                </FormSubmitButton>
              </div>
            </div>
            {msg ? <p style={{ marginTop: 10, color: "#b00" }}>{msg}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 13, color: "#444" };
}
function input(): React.CSSProperties {
  return { padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%", outline: "none" };
}
function alert(): React.CSSProperties {
  return { border: "1px solid #ffd6d6", background: "#fff5f5", color: "#8a1f1f", borderRadius: 12, padding: 12 };
}
function backdrop(): React.CSSProperties {
  return { position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 };
}
function sheet(): React.CSSProperties {
  return { width: "min(520px, 100%)", background: "white", borderRadius: 14, border: "1px solid #eee", padding: 14 };
}
