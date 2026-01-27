"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

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
  const [loading, setLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string>("");

  const [form, setForm] = useState<CustomerForm>({
    name: "",
    phone: "",
    address: "",
  });

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
      .order("created_at", { ascending: false });

    if (error) {
      setLoading(false);
      return setMsg(error.message);
    }

    setCustomers(data || []);
    setLoading(false);
  }

  function openCreate() {
    setMode("create");
    setEditingId("");
    setForm({ name: "", phone: "", address: "" });
    setSheetOpen(true);
  }

  function openEdit(row: any) {
    setMode("edit");
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      phone: row.phone || "",
      address: row.address || "",
    });
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

  useEffect(() => {
    loadOrgId();
    loadCustomers();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) => {
      const a = `${c.name || ""} ${c.phone || ""} ${c.address || ""}`.toLowerCase();
      return a.includes(term);
    });
  }, [customers, q]);

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Customer</h1>
          <p style={{ marginTop: 6, color: "#666" }}>Kelola data pelanggan untuk invoice</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <a href="/dashboard" style={btn()}>Dashboard</a>
          <a href="/invoice" style={btn()}>Invoice</a>
          <button onClick={openCreate} style={btnPrimary()}>+ Tambah Customer</button>
        </div>
      </div>

      {msg ? (
        <div style={{ marginTop: 12, ...alert() }}>
          <b>Ada masalah:</b> {msg}
        </div>
      ) : null}

      <div style={{ marginTop: 12, ...card() }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <input
            placeholder="Cari nama / telp / alamat..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ ...input(), width: 320 }}
          />
          <div style={{ color: "#666", fontSize: 13 }}>
            Total: <b>{filtered.length}</b>
          </div>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th()}>Nama</th>
                <th style={th()}>No HP</th>
                <th style={th()}>Alamat</th>
                <th style={th()}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={td()}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} style={td()}>Belum ada customer.</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id}>
                    <td style={tdStrong()}>{c.name}</td>
                    <td style={td()}>{c.phone || "-"}</td>
                    <td style={{ ...td(), whiteSpace: "pre-wrap" }}>{c.address || "-"}</td>
                    <td style={td()}>
                      <button onClick={() => openEdit(c)} style={miniBtn()}>Edit</button>
                      <button onClick={() => deleteCustomer(c.id)} style={miniBtnDanger()}>Hapus</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simple Sheet/Modal */}
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
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  style={{ ...input(), minHeight: 90 }}
                />
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
    </div>
  );
}

function card(): React.CSSProperties {
  return { border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white" };
}
function alert(): React.CSSProperties {
  return { border: "1px solid #ffd6d6", background: "#fff5f5", color: "#8a1f1f", borderRadius: 12, padding: 12 };
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
function th(): React.CSSProperties {
  return { textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px", color: "#666", fontWeight: 600 };
}
function td(): React.CSSProperties {
  return { borderBottom: "1px solid #f2f2f2", padding: "10px 6px", verticalAlign: "top" };
}
function tdStrong(): React.CSSProperties {
  return { ...td(), fontWeight: 700 };
}
function backdrop(): React.CSSProperties {
  return { position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "grid", placeItems: "center", padding: 16 };
}
function sheet(): React.CSSProperties {
  return { width: "min(520px, 100%)", background: "white", borderRadius: 14, border: "1px solid #eee", padding: 14 };
}