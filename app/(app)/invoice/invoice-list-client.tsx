// app/invoice/invoice-list-client.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FormSubmitButton from "../components/form-submit-button";
import { useSubmitGuard } from "../components/use-submit-guard";
import TableEmptyState from "../components/table-empty-state";
import { toastError, toastSuccess } from "@/lib/app-toast";

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  status: string | null;

  customer_name: string | null;

  grand_total: number;
  amount_paid: number;
  remaining: number;

  pay_label: "UNPAID" | "PARTIAL" | "PAID";
};

function rupiah(n: number) {
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

function digitsOnly(s: string) {
  return (s || "").replace(/[^\d]/g, "");
}

function toRpInput(digits: string) {
  const num = digits ? parseInt(digits, 10) : 0;
  return digits ? rupiah(num) : "";
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function InvoiceListClient({ rows }: { rows: InvoiceRow[] }) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<InvoiceRow | null>(null);

  const [paidAt, setPaidAt] = useState(todayISO());
  const [amountDigits, setAmountDigits] = useState("");
  const amountNum = useMemo(
    () => (amountDigits ? parseInt(amountDigits, 10) : 0),
    [amountDigits]
  );

  const [loading, setLoading] = useState(false);
  const { tryBegin, end, isBlocked } = useSubmitGuard(setLoading);

  // delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openPay(r: InvoiceRow) {
    setTarget(r);
    setPaidAt(todayISO());
    const sisa = Math.max(0, Math.floor(r.remaining));
    setAmountDigits(sisa > 0 ? String(sisa) : "");
    setOpen(true);
  }

  function closePay() {
    if (loading) return;
    setOpen(false);
    setTarget(null);
  }

  async function submitPay() {
    if (isBlocked()) return;
    if (!target) return;
    if (!paidAt) {
      toastError("Tanggal bayar wajib diisi.");
      return;
    }
    if (!amountNum || amountNum <= 0) {
      toastError("Nominal harus lebih dari 0.");
      return;
    }

    if (!tryBegin()) return;
    try {
      const res = await fetch(`/api/invoice/payments/${target.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid_at: paidAt, amount: amountNum }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(json?.error || `Gagal mencatat pembayaran (${res.status})`);
        return;
      }

      setOpen(false);
      setTarget(null);
      toastSuccess("Pembayaran berhasil dicatat.");
      router.refresh();
    } catch (e: any) {
      toastError(e?.message || "Gagal mencatat pembayaran.");
    } finally {
      end();
    }
  }

  function goEdit(id: string) {
    // page kamu sudah ada: /invoice/edit/[id]
    router.push(`/invoice/edit/${id}`);
  }

  async function onDelete(r: InvoiceRow) {
    // safety: invoice paid jangan dihapus dari UI
    if (r.pay_label === "PAID") return;

    const ok = confirm(
      `Hapus invoice ${r.invoice_number || ""}?\n\n` +
        `Ini akan menghapus invoice & item-nya.`
    );
    if (!ok) return;

    setDeletingId(r.id);
    try {
      // NOTE: endpoint DELETE ini harus kamu sediakan.
      // Kalau kamu sudah punya endpoint lain, tinggal ganti path-nya.
      const res = await fetch(`/api/invoices/${r.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(json?.error || `Gagal menghapus invoice (${res.status})`);
        return;
      }

      toastSuccess("Invoice berhasil dihapus.");
      router.refresh();
    } catch (e: any) {
      toastError(e?.message || "Gagal menghapus invoice.");
    } finally {
      setDeletingId(null);
    }
  }

  const actionBtn: React.CSSProperties = {
    height: 34,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  const actionBtnLight: React.CSSProperties = {
    height: 34,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "white",
    color: "#111",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  const actionBtnDanger: React.CSSProperties = {
    height: 34,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #ef4444",
    background: "#fff5f5",
    color: "#b91c1c",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  const disabledBtn: React.CSSProperties = {
    opacity: 0.55,
    cursor: "not-allowed",
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#666" }}>
              <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 220 }}>
                Invoice
              </th>
              <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 240 }}>
                Pelanggan
              </th>
              <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 120 }}>
                Status
              </th>
              <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 160 }}>
                Total
              </th>
              <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 160 }}>
                Terbayar
              </th>
              <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 160 }}>
                Sisa
              </th>
              <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 240 }}>
                Aksi
              </th>
            </tr>
          </thead>

          <tbody>
            {!rows.length && (
              <TableEmptyState colSpan={7} message="Belum ada invoice." />
            )}

            {rows.map((r) => {
              const badge =
                r.pay_label === "PAID"
                  ? { bg: "#ecfdf5", bd: "#6ee7b7", fg: "#065f46" }
                  : r.pay_label === "PARTIAL"
                  ? { bg: "#eff6ff", bd: "#93c5fd", fg: "#1e3a8a" }
                  : { bg: "#fff7ed", bd: "#fdba74", fg: "#9a3412" };

              const isPaid = r.pay_label === "PAID";
              const isDeleting = deletingId === r.id;

              return (
                <tr key={r.id}>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                    <div style={{ fontWeight: 900 }}>
                      <a href={`/invoice/${r.id}`} style={{ color: "#111", textDecoration: "none" }}>
                        {r.invoice_number || "(tanpa nomor)"}
                      </a>
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{r.invoice_date || "-"}</div>
                  </td>

                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                    {r.customer_name || "-"}
                  </td>

                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        height: 28,
                        padding: "0 10px",
                        borderRadius: 999,
                        background: badge.bg,
                        border: `1px solid ${badge.bd}`,
                        color: badge.fg,
                        fontWeight: 900,
                        fontSize: 12,
                        letterSpacing: 0.3,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.pay_label}
                    </span>
                  </td>

                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3", fontWeight: 900 }}>
                    {rupiah(r.grand_total)}
                  </td>

                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3", fontWeight: 900 }}>
                    {rupiah(r.amount_paid)}
                  </td>

                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3", fontWeight: 900 }}>
                    {rupiah(r.remaining)}
                  </td>

                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {/* Bayar */}
                      <button
                        type="button"
                        onClick={() => openPay(r)}
                        disabled={loading}
                        style={{ ...actionBtn, ...(loading ? disabledBtn : {}) }}
                        title="Tambah pembayaran"
                      >
                        Bayar
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => goEdit(r.id)}
                        disabled={isPaid || loading}
                        style={{
                          ...actionBtnLight,
                          ...(isPaid || loading ? disabledBtn : {}),
                        }}
                        title={isPaid ? "Invoice sudah paid (dikunci)" : "Edit invoice"}
                      >
                        Edit
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => onDelete(r)}
                        disabled={isPaid || loading || isDeleting}
                        style={{
                          ...actionBtnDanger,
                          ...(isPaid || loading || isDeleting ? disabledBtn : {}),
                        }}
                        title={isPaid ? "Invoice paid tidak bisa dihapus" : "Hapus invoice"}
                      >
                        {isDeleting ? "..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL QUICK PAY */}
      {open && target && (
        <div
          onClick={closePay}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            padding: 14,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              borderRadius: 14,
              background: "white",
              border: "1px solid #eee",
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Tambah Pembayaran</div>
                <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>
                  {target.invoice_number} • Sisa: <b>{rupiah(target.remaining)}</b>
                </div>
              </div>
              <button
                type="button"
                onClick={closePay}
                disabled={loading}
                style={{
                  height: 34,
                  padding: "0 10px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 900,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Tanggal bayar</div>
                <input
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    outline: "none",
                    fontWeight: 700,
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Nominal</div>
                <input
                  value={toRpInput(amountDigits)}
                  onChange={(e) => setAmountDigits(digitsOnly(e.target.value))}
                  placeholder="Rp 0"
                  inputMode="numeric"
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    outline: "none",
                    fontWeight: 900,
                  }}
                />
                <div style={{ fontSize: 12, color: "#666" }}>Ketik angka saja: 10000 → Rp 10.000</div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={closePay}
                  disabled={loading}
                  style={{
                    height: 42,
                    flex: 1,
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontWeight: 900,
                  }}
                >
                  Batal
                </button>

                <FormSubmitButton
                  type="button"
                  onClick={submitPay}
                  busy={loading}
                  busyLabel="Menyimpan..."
                  style={{ height: 42, flex: 1, borderRadius: 10 }}
                >
                  Simpan
                </FormSubmitButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}