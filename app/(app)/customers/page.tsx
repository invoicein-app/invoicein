"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import ListPageLayout from "../components/list-page-layout";
import ListFiltersClient from "../components/list-filters-client";
import { listTableStyles } from "../components/list-page-layout";

type CustomerForm = {
  name: string;
  phone: string;
  address: string;
};

export default function CustomersPage() {
  const supabase = supabaseBrowser();

  const [customers, setCustomers] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string>("");
  const [form, setForm] = useState<CustomerForm>({ name: "", phone: "", address: "" });

  async function loadOrgId() {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return;
    const { data: mem, error } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (error) return setMsg(error.message);
    if (!mem?.org_id) return setMsg("Org ID tidak ditemukan");
    setOrgId(mem.org_id);
  }

  async function loadCustomers() {
    setLoading(true);
    setMsg("");
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("org_id", orgId || "")
      .order("created_at", { ascending: false });

    if (error) {
      setLoading(false);
      return setMsg(error.message);
    }
    setCustomers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadOrgId();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) => {
      const a = `${c.name || ""} ${c.phone || ""} ${c.address || ""}`.toLowerCase();
      return a.includes(term);
    });
  }, [customers, q]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  const paginated = useMemo(
    () => filtered.slice(fromIdx, fromIdx + pageSize),
    [filtered, fromIdx, pageSize]
  );

  function openCreate() {
    setMode("create");
    setEditingId("");
    setForm({ name: "", phone: "", address: "" });
    setSheetOpen(true);
  }

  function openEdit(row: any) {
    setMode("edit");
    setEditingId(row.id);
    setForm({ name: row.name || "", phone: row.phone || "", address: row.address || "" });
    setSheetOpen(true);
  }

  async function saveCustomer() {
    setMsg("");
    if (!orgId) return setMsg("Org ID belum siap, refresh halaman.");
    if (!form.name.trim()) return setMsg("Nama customer wajib diisi.");
    if (mode === "create") {
      const { error } = await supabase.from("customers").insert({
        org_id: orgId,
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });
      if (error) return setMsg(error.message);
    } else {
      const { error } = await supabase
        .from("customers")
        .update({
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
        })
        .eq("id", editingId);
      if (error) return setMsg(error.message);
    }
    setSheetOpen(false);
    await loadCustomers();
  }

  async function deleteCustomer(id: string) {
    setMsg("");
    if (!confirm("Hapus customer ini?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return setMsg(error.message);
    await loadCustomers();
  }

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
      searchPlaceholder="Cari nama / telp / alamat..."
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
    >
      <button type="button" onClick={openCreate} style={btnPrimary()}>+ Tambah Customer</button>
    </ListFiltersClient>
  );

  const tableContent = (
    <table style={listTableStyles.table}>
      <thead>
        <tr style={listTableStyles.thead}>
          <th style={listTableStyles.th}>Nama</th>
          <th style={listTableStyles.th}>No HP</th>
          <th style={listTableStyles.th}>Alamat</th>
          <th style={listTableStyles.th}>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={4} style={listTableStyles.td}>Loading...</td></tr>
        ) : paginated.length === 0 ? (
          <tr><td colSpan={4} style={listTableStyles.empty}>Belum ada customer.</td></tr>
        ) : (
          paginated.map((c) => (
            <tr key={c.id}>
              <td style={{ ...listTableStyles.td, fontWeight: 700 }}>{c.name}</td>
              <td style={listTableStyles.td}>{c.phone || "-"}</td>
              <td style={{ ...listTableStyles.td, whiteSpace: "pre-wrap" }}>{c.address || "-"}</td>
              <td style={listTableStyles.td}>
                <button onClick={() => openEdit(c)} style={miniBtn()}>Edit</button>
                <button onClick={() => deleteCustomer(c.id)} style={miniBtnDanger()}>Hapus</button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
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
        emptyMessage="Belum ada customer."
      />

      {msg ? (
        <div style={{ marginTop: 12, padding: 24, width: "100%", boxSizing: "border-box" }}>
          <div style={alert()}>
            <b>Ada masalah:</b> {msg}
          </div>
        </div>
      ) : null}

      {sheetOpen ? (
        <div style={backdrop()}>
          <div style={sheet()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0 }}>{mode === "create" ? "Tambah Customer" : "Edit Customer"}</h3>
                <p style={{ marginTop: 6, color: "#666" }}>Data ini dipakai untuk invoice & surat jalan</p>
              </div>
              <button onClick={() => setSheetOpen(false)} style={btn()}>Tutup</button>
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
                <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={{ ...input(), minHeight: 90 }} />
              </label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setSheetOpen(false)} style={btn()}>Batal</button>
                <button onClick={saveCustomer} style={btnPrimary()}>Simpan</button>
              </div>
            </div>
            {msg ? <p style={{ marginTop: 10, color: "#b00" }}>{msg}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function btn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer", textDecoration: "none", color: "#111" };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", cursor: "pointer" };
}
function miniBtn(): React.CSSProperties {
  return { padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer", marginRight: 8 };
}
function miniBtnDanger(): React.CSSProperties {
  return { padding: "6px 10px", borderRadius: 10, border: "1px solid #b00", background: "#fff5f5", cursor: "pointer" };
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
  return { position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "grid", placeItems: "center", padding: 16 };
}
function sheet(): React.CSSProperties {
  return { width: "min(520px, 100%)", background: "white", borderRadius: 14, border: "1px solid #eee", padding: 14 };
}
