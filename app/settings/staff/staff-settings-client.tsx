// app/settings/staff/staff-settings-client.tsx
// FULL REPLACE — ini isi client page kamu (yang kamu paste barusan)
// (Aku cuma ganti export default namanya biar bisa di-import dari page.tsx)
"use client";

import { useEffect, useState } from "react";

type OrgRow = {
  id: string;
  name: string | null;
  org_code: string | null;
};

type MemberRow = {
  id: string;
  user_id: string;
  org_id: string;
  username: string | null;
  role: "admin" | "staff";
  created_at: string;
  is_active: boolean;
};

export default function StaffSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"staff">("staff");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/members/list-staff");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Gagal load staff");
      setOrg(json.org || null);
      setMembers(json.members || []);
    } catch (e: any) {
      setMsg(e?.message || "Gagal load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setCreating(true);

    try {
      if (!username.trim()) throw new Error("Username wajib");
      if (password.length < 6) throw new Error("Password minimal 6 karakter");

      const res = await fetch("/api/members/create-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Gagal membuat staff");

      setUsername("");
      setPassword("");
      setRole("staff");
      setMsg("✅ Staff berhasil dibuat.");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Gagal membuat staff");
    } finally {
      setCreating(false);
    }
  }

  const box: React.CSSProperties = {
    maxWidth: 920,
    margin: "24px auto",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#111827",
    outline: "none",
  };

  const btn: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };

  const chip: React.CSSProperties = {
    display: "inline-block",
    padding: "8px 10px",
    borderRadius: 12,
    background: "#111827",
    color: "white",
    fontWeight: 900,
    letterSpacing: 0.8,
    minWidth: 100,
    textAlign: "center",
  };
  const visibleMembers = (members || []).filter((m) => {
  const u = (m.username ?? "").trim();
  const isOwnerAdminWithoutUsername = m.role === "admin" && (u === "" || u === "-");
  return !isOwnerAdminWithoutUsername;
});
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 16 }}>
      <div style={box}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" }}>
              Pengaturan Staff
            </h1>
            <div style={{ marginTop: 6, color: "#6b7280", fontSize: 13 }}>
              Admin membuat akun staff. Staff login pakai <b>Org Code</b> + <b>Username</b>.
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#111827" }}>Org Code</div>
            <div style={{ marginTop: 6 }}>
              <span style={chip}>{org?.org_code || "-"}</span>
            </div>
          </div>
        </div>

        {msg ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: msg.startsWith("✅") ? "#ecfdf5" : "#fef2f2",
              border: msg.startsWith("✅") ? "1px solid #a7f3d0" : "1px solid #fecaca",
              color: msg.startsWith("✅") ? "#065f46" : "#991b1b",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {msg}
          </div>
        ) : null}

        <div style={{ marginTop: 18, borderTop: "1px solid #e5e7eb", paddingTop: 18 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#111827" }}>
            Tambah Staff
          </h2>

          <form onSubmit={onCreate} style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
                  Username
                </div>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="contoh: kasir1"
                  style={input}
                  autoCapitalize="none"
                />
                <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>Unik per organisasi.</div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
                  Role
                </div>
                <select value={role} onChange={(e) => setRole(e.target.value as any)} style={input}>
                  <option value="staff">staff</option>
                </select>
                <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>Normalnya cukup “staff”.</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
                Password
              </div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min 6 karakter"
                type="password"
                style={input}
              />
            </div>

            <button disabled={creating} style={{ ...btn, opacity: creating ? 0.7 : 1 }}>
              {creating ? "Membuat..." : "Buat Akun Staff"}
            </button>

            <div style={{ color: "#6b7280", fontSize: 12 }}>
              Setelah dibuat, kasih ke staff: <b>Org Code</b> + <b>Username</b> + <b>Password</b>.
            </div>
          </form>
        </div>

        <div style={{ marginTop: 18, borderTop: "1px solid #e5e7eb", paddingTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#111827" }}>
              Daftar Member
            </h2>
            <button
              type="button"
              onClick={load}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #cbd5e1",
                background: "white",
                color: "#111827",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 0.8fr 1fr",
                background: "#f1f5f9",
                padding: 10,
                fontWeight: 900,
              }}
            >
              <div>Username</div>
              <div>Role</div>
              <div>Dibuat</div>
            </div>

            {(visibleMembers || []).length === 0 ? (
              <div style={{ padding: 12, color: "#6b7280" }}>Belum ada staff.</div>
            ) : (
             visibleMembers.map((m) => {
    const disabled = !m.is_active; // atau logic disabled kamu yg sudah ada

  async function setActive(isActive: boolean) {
    setMsg("");
    try {
      const res = await fetch("/api/members/set-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: m.id, isActive }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Gagal update status");
      setMsg(isActive ? "✅ Staff diaktifkan." : "✅ Staff dinonaktifkan.");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Gagal update status");
    }
  }

  async function resetPassword() {
    const newPass = prompt("Masukkan password baru (min 6 karakter):");
    if (!newPass) return;
    if (newPass.length < 6) {
      alert("Password minimal 6 karakter.");
      return;
    }

    setMsg("");
    try {
      const res = await fetch("/api/members/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: m.id, newPassword: newPass }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Gagal reset password");
      setMsg("✅ Password staff berhasil direset.");
    } catch (e: any) {
      setMsg(e?.message || "Gagal reset password");
    }
  }

  async function deleteStaff() {
    const ok = confirm(`Hapus staff "${m.username || "-"}" ?\nIni akan menghapus akun login juga.`);
    if (!ok) return;

    setMsg("");
    try {
      const res = await fetch("/api/members/delete-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: m.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Gagal delete staff");
      setMsg("✅ Staff berhasil dihapus.");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Gagal delete staff");
    }
  }

  const actionBtn: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "white",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 12,
  };

  const dangerBtn: React.CSSProperties = {
    ...actionBtn,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
  };
  return (
    <div
      key={m.id}
      style={{
        display: "grid",
        gridTemplateColumns: "1.2fr 0.8fr 1fr 1.6fr",
        padding: 10,
        borderTop: "1px solid #e5e7eb",
        alignItems: "center",
        gap: 10,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{ fontWeight: 800, color: "#111827" }}>
        {m.username || "-"} {disabled ? <span style={{ color: "#991b1b" }}>(disabled)</span> : null}
      </div>

      <div>{m.role}</div>

      <div style={{ color: "#6b7280", fontSize: 12 }}>{String(m.created_at).slice(0, 10)}</div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {disabled ? (
          <button type="button" style={actionBtn} onClick={() => setActive(true)}>
            Enable
          </button>
        ) : (
          <button type="button" style={actionBtn} onClick={() => setActive(false)}>
            Disable
          </button>
        )}

        <button type="button" style={actionBtn} onClick={resetPassword}>
          Reset Password
        </button>

        <button type="button" style={dangerBtn} onClick={deleteStaff}>
          Delete
        </button>
      </div>
    </div>
  );
})
            )}
          </div>
        </div>
      </div>
    </div>
  );
}