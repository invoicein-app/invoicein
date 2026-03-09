// ✅ FULL REPLACE FILE
// invoiceku/app/(app)/purchase-orders/[id]/po-actions-client.tsx

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

function isAdminRole(role: string) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "owner" || r === "super_admin";
}

export default function PoActionsClient(props: {
  id: string;
  poNumber?: string | null;
  status?: string | null;
}) {
  const { id, poNumber, status } = props;

  const router = useRouter();
  const supabase = supabaseBrowser();

  const [role, setRole] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const st = String(status || "draft").toLowerCase();

  const canEdit = st === "draft";
  const canDelete = st === "draft";
  const canCancel = st === "draft" || st === "sent" || st === "partially_received";
  const canSend = st === "draft";

  // ✅ penting: GRN boleh saat SENT & PARTIALLY_RECEIVED
  const canReceive = st === "sent" || st === "partially_received";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (!userRes.user) return;

        const { data: mem } = await supabase
          .from("memberships")
          .select("role")
          .eq("user_id", userRes.user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (alive) setRole(String((mem as any)?.role || ""));
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  const isStaff = useMemo(() => !isAdminRole(role), [role]);

  // =========================
  // SEND
  // =========================
  async function onSend() {
    setMsg("");

    if (!canSend) return setMsg("Hanya PO DRAFT yang bisa di-SEND.");

    const ok = window.confirm(`Kirim PO ${poNumber || ""} ke vendor?`);
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}/send`, {
        method: "POST",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) return setMsg(json?.error || `Gagal send (${res.status})`);

      router.push("/purchase-orders");
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || "Gagal send PO.");
    } finally {
      setBusy(false);
    }
  }

  // =========================
  // CANCEL
  // =========================
  async function onCancel() {
    setMsg("");

    if (!canCancel) return setMsg("PO tidak bisa di-cancel.");
    if (isStaff && st !== "draft")
      return setMsg("Staff hanya boleh cancel PO saat status DRAFT.");

    const reason = window.prompt("Alasan cancel? (optional)") || "";
    const ok = window.confirm(
      `Cancel PO ${poNumber || ""}?\n\nPO akan menjadi CANCELLED.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) return setMsg(json?.error || `Gagal cancel (${res.status})`);

      router.push("/purchase-orders");
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || "Gagal cancel PO.");
    } finally {
      setBusy(false);
    }
  }

  // =========================
  // DELETE
  // =========================
  async function onDelete() {
    setMsg("");

    if (!canDelete) return setMsg("Hanya PO DRAFT yang bisa dihapus.");
    if (isStaff && st !== "draft")
      return setMsg("Staff hanya boleh hapus PO DRAFT.");

    const ok = window.confirm(
      `Hapus PO ${poNumber || ""}?\n\nIni akan menghapus PO dan semua item-nya.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) return setMsg(json?.error || `Gagal hapus (${res.status})`);

      router.push("/purchase-orders");
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || "Gagal hapus PO.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {canEdit && (
        <Link href={`/purchase-orders/${id}/edit`} style={btnSoftLink()}>
          Edit
        </Link>
      )}

      {canSend && (
        <button onClick={onSend} disabled={busy} style={btnSoft()}>
          Send
        </button>
      )}

      {/* ✅ ini tombol GRN yang bener: bukan call API, tapi masuk ke UI receive */}
      {canReceive && (
        <Link
          href={`/purchase-orders/${id}/receive`}
          style={btnPrimaryLink()}
          onClick={(e) => {
            // prevent spam click while busy
            if (busy) e.preventDefault();
          }}
        >
          Terima Barang (GRN)
        </Link>
      )}

      {canCancel && (
        <button onClick={onCancel} disabled={busy} style={btnSoft()}>
          Cancel
        </button>
      )}

      {canDelete && (
        <button onClick={onDelete} disabled={busy} style={btnDanger()}>
          Delete
        </button>
      )}

      {msg && (
        <span style={{ color: "#b91c1c", fontWeight: 900, fontSize: 12 }}>
          {msg}
        </span>
      )}
    </div>
  );
}

function btnSoftLink(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    color: "#111827",
    fontWeight: 900,
    textDecoration: "none",
  };
}

function btnSoft(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnPrimaryLink(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 900,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  };
}

function btnDanger(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #b91c1c",
    background: "#fef2f2",
    color: "#991b1b",
    fontWeight: 900,
    cursor: "pointer",
  };
}