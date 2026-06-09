"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formPrimaryButton } from "../../components/app-action-buttons";
import FormSubmitButton from "../../components/form-submit-button";
import { useSubmitGuard } from "../../components/use-submit-guard";
import type { CompanyBankAccount } from "@/lib/company-bank-accounts";

const TEAL = "#1D7A73";

const BANK_OPTIONS = [
  "BCA",
  "Mandiri",
  "BRI",
  "BNI",
  "BSI",
  "CIMB Niaga",
  "Permata",
  "Danamon",
  "Maybank",
  "OCBC NISP",
  "Bank Jago",
  "SeaBank",
  "Lainnya",
];

type FormState = {
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  branch: string;
  is_active: boolean;
  is_default: boolean;
};

const emptyForm = (): FormState => ({
  bank_name: "",
  account_number: "",
  account_holder_name: "",
  branch: "",
  is_active: true,
  is_default: false,
});

export default function BankAccountsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<CompanyBankAccount[]>([]);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const { tryBegin, end, isBlocked } = useSubmitGuard(setSaving);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/company-bank-accounts", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Gagal memuat rekening");
      setItems((json.items || []) as CompanyBankAccount[]);
    } catch (e: any) {
      setMsg(e?.message || "Gagal memuat rekening");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startAdd() {
    setEditingId("new");
    const hasDefault = items.some((x) => x.is_default);
    setForm({
      ...emptyForm(),
      is_default: items.length === 0 || !hasDefault,
    });
    setMsg("");
  }

  function startEdit(item: CompanyBankAccount) {
    setEditingId(item.id);
    setForm({
      bank_name: item.bank_name,
      account_number: item.account_number,
      account_holder_name: item.account_holder_name,
      branch: item.branch || "",
      is_active: item.is_active,
      is_default: item.is_default,
    });
    setMsg("");
  }

  function cancelForm() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function saveForm() {
    if (isBlocked()) return;
    if (!tryBegin()) return;
    setMsg("");
    try {
      const isNew = editingId === "new";
      const res = await fetch(
        isNew ? "/api/company-bank-accounts" : `/api/company-bank-accounts/${editingId}`,
        {
          method: isNew ? "POST" : "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bank_name: form.bank_name,
            account_number: form.account_number,
            account_holder_name: form.account_holder_name,
            branch: form.branch || null,
            is_active: form.is_active,
            is_default: form.is_default,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      cancelForm();
      await load();
      setMsg("Rekening disimpan.");
    } catch (e: any) {
      setMsg(e?.message || "Gagal menyimpan");
    } finally {
      end();
    }
  }

  async function toggleActive(item: CompanyBankAccount) {
    if (isBlocked()) return;
    if (!tryBegin()) return;
    setMsg("");
    try {
      const res = await fetch(`/api/company-bank-accounts/${item.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Gagal mengubah status");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Gagal mengubah status");
    } finally {
      end();
    }
  }

  async function setDefault(item: CompanyBankAccount) {
    if (item.is_default) return;
    if (isBlocked()) return;
    if (!tryBegin()) return;
    setMsg("");
    try {
      const res = await fetch(`/api/company-bank-accounts/${item.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true, is_active: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Gagal menjadikan default");
      await load();
      setMsg("Rekening default diperbarui.");
    } catch (e: any) {
      setMsg(e?.message || "Gagal menjadikan default");
    } finally {
      end();
    }
  }

  async function removeItem(item: CompanyBankAccount) {
    if (isBlocked()) return;
    if (!confirm(`Hapus rekening ${item.bank_name} ${item.account_number}?`)) return;
    if (!tryBegin()) return;
    setMsg("");
    try {
      const res = await fetch(`/api/company-bank-accounts/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Gagal menghapus");
      if (editingId === item.id) cancelForm();
      await load();
      setMsg("Rekening dihapus.");
    } catch (e: any) {
      setMsg(e?.message || "Gagal menghapus");
    } finally {
      end();
    }
  }

  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 20,
    background: "#fff",
  };

  return (
    <div style={{ width: "100%", padding: "24px 20px 40px", boxSizing: "border-box" }}>
      <Link href="/settings" style={{ color: TEAL, fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
        ← Kembali ke Pengaturan
      </Link>

      <h1 style={{ margin: "16px 0 6px", fontSize: 24, fontWeight: 800 }}>Rekening Pembayaran</h1>
      <p style={{ margin: "0 0 24px", color: "#64748b", fontSize: 14, lineHeight: 1.5, maxWidth: 720 }}>
        Kelola beberapa rekening perusahaan. Saat membuat invoice, Anda bisa memilih rekening mana yang
        ditampilkan di PDF. Jika tidak dipilih, sistem memakai rekening default.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button type="button" onClick={startAdd} disabled={saving || editingId === "new"} style={formPrimaryButton()}>
          + Tambah Rekening
        </button>
      </div>

      {editingId ? (
        <div style={{ ...card, marginBottom: 16 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800 }}>
            {editingId === "new" ? "Rekening Baru" : "Edit Rekening"}
          </h2>
          <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
            <label style={label()}>
              Nama Bank *
              <select
                value={form.bank_name}
                onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
                style={input()}
              >
                <option value="">Pilih bank</option>
                {BANK_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label style={label()}>
              Nomor Rekening *
              <input
                value={form.account_number}
                onChange={(e) => setForm((p) => ({ ...p, account_number: e.target.value }))}
                style={input()}
                placeholder="Contoh: 1234567890"
              />
            </label>
            <label style={label()}>
              Atas Nama *
              <input
                value={form.account_holder_name}
                onChange={(e) => setForm((p) => ({ ...p, account_holder_name: e.target.value }))}
                style={input()}
                placeholder="Nama pemilik rekening"
              />
            </label>
            <label style={label()}>
              Cabang (opsional)
              <input
                value={form.branch}
                onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))}
                style={input()}
                placeholder="Contoh: Cabang Surabaya"
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              />
              Aktif (bisa dipilih di invoice)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))}
              />
              Jadikan rekening default
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <FormSubmitButton type="button" onClick={saveForm} busy={saving} busyLabel="Menyimpan…">
                Simpan
              </FormSubmitButton>
              <button type="button" onClick={cancelForm} disabled={saving} style={btnSecondary()}>
                Batal
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {msg ? (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: msg.includes("Gagal") ? "#b91c1c" : "#15803d" }}>
          {msg}
        </p>
      ) : null}

      {loading ? (
        <div style={{ color: "#64748b" }}>Memuat rekening…</div>
      ) : items.length === 0 ? (
        <div style={card}>
          <p style={{ margin: 0, color: "#64748b" }}>
            Belum ada rekening. Tambahkan rekening pertama untuk ditampilkan di invoice.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => (
            <div key={item.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>
                    {item.bank_name} — {item.account_number}
                  </div>
                  <div style={{ marginTop: 4, color: "#475569", fontSize: 14 }}>
                    a.n. {item.account_holder_name}
                    {item.branch ? ` • ${item.branch}` : ""}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {item.is_default ? (
                      <span style={badge("#ecfdf5", "#15803d")}>Default</span>
                    ) : null}
                    <span style={badge(item.is_active ? "#eff6ff" : "#f1f5f9", item.is_active ? "#1d4ed8" : "#64748b")}>
                      {item.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                  {!item.is_default && item.is_active ? (
                    <button type="button" onClick={() => setDefault(item)} disabled={saving} style={btnSecondary()}>
                      Jadikan Default
                    </button>
                  ) : null}
                  <button type="button" onClick={() => toggleActive(item)} disabled={saving} style={btnSecondary()}>
                    {item.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  <button type="button" onClick={() => startEdit(item)} disabled={saving} style={btnSecondary()}>
                    Edit
                  </button>
                  <button type="button" onClick={() => removeItem(item)} disabled={saving} style={btnDanger()}>
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 13, color: "#334155", fontWeight: 600 };
}

function input(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    width: "100%",
    boxSizing: "border-box",
    fontSize: 14,
  };
}

function btnSecondary(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  };
}

function btnDanger(): React.CSSProperties {
  return {
    ...btnSecondary(),
    color: "#b91c1c",
    borderColor: "#fecaca",
  };
}

function badge(bg: string, color: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 700,
  };
}
