"use client";

import { useMemo, useState } from "react";

const ENTITY_LABELS: Record<string, string> = {
  invoice: "Invoice",
  purchase_order: "PO",
  po: "PO",
  delivery_note: "Surat Jalan",
  quotation: "Quotation",
  payment: "Payment",
  warehouse: "Warehouse",
  vendor: "Vendor",
  product: "Barang",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
  sent: "Sent",
  post: "Post",
  cancel: "Cancel",
  receive: "Receive",
  deactivate: "Deactivate",
};

function getEntityLabel(action: string): string {
  if (!action || typeof action !== "string") return "—";
  const part = action.split(".")[0]?.toLowerCase() || "";
  return ENTITY_LABELS[part] || part.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";
}

function getActionLabel(action: string): string {
  if (!action || typeof action !== "string") return "—";
  const part = action.split(".").slice(1).join(".").toLowerCase() || "";
  return ACTION_LABELS[part] || part.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";
}

type TimeFilter = "today" | "7d" | "30d" | "all";

function parseDate(s: string): Date {
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function formatTime(createdAt: string): string {
  const d = parseDate(createdAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const logDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - logDate.getTime()) / (24 * 60 * 60 * 1000));
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Hari ini ${time}`;
  if (diffDays === 1) return `Kemarin ${time}`;
  if (diffDays < 7) return `${diffDays} hari lalu · ${time}`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) + " · " + time;
}

function filterLogs(logs: any[], filter: TimeFilter): any[] {
  if (filter === "all") return logs;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoff =
    filter === "today"
      ? todayStart
      : filter === "7d"
        ? new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
        : new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
  return logs.filter((l) => parseDate(l.created_at) >= cutoff);
}

function formatRupiah(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateOnly(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

type Fact = { label: string; value: string };

function extractFacts(action: string, meta: any): Fact[] {
  const facts: Fact[] = [];
  if (!meta || typeof meta !== "object") return facts;

  const actionLower = (action || "").toLowerCase();
  const num = (key: string) => {
    const v = meta[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const has = (key: string) => {
    const v = meta[key];
    return v !== undefined && v !== null && v !== "";
  };

  // invoice.create
  if (actionLower === "invoice.create") {
    if (has("customer_name")) facts.push({ label: "Pelanggan", value: String(meta.customer_name).trim() });
    if (has("total")) facts.push({ label: "Total", value: formatRupiah(num("total")) });
    else if (has("subtotal")) facts.push({ label: "Subtotal", value: formatRupiah(num("subtotal")) });
    if (has("status")) facts.push({ label: "Status", value: String(meta.status) });
    if (has("due_date")) facts.push({ label: "Jatuh tempo", value: formatDateOnly(meta.due_date) });
    if (has("items_count")) facts.push({ label: "Item", value: String(meta.items_count) });
    return facts;
  }

  // invoice.update
  if (actionLower === "invoice.update") {
    if (meta.after && typeof meta.after === "object") {
      const a = meta.after as any;
      if (a.grand_total != null) facts.push({ label: "Total", value: formatRupiah(Number(a.grand_total)) });
      if (a.total != null) facts.push({ label: "Total", value: formatRupiah(Number(a.total)) });
    }
    if (has("items_count")) facts.push({ label: "Item", value: String(meta.items_count) });
    return facts;
  }

  // invoice.delete
  if (actionLower === "invoice.delete" && meta.before) {
    const b = meta.before as any;
    if (b.grand_total != null) facts.push({ label: "Total", value: formatRupiah(Number(b.grand_total)) });
    else if (b.total != null) facts.push({ label: "Total", value: formatRupiah(Number(b.total)) });
    return facts;
  }

  // invoice.sent
  if (actionLower === "invoice.sent") {
    if (has("customer_name")) facts.push({ label: "Pelanggan", value: String(meta.customer_name).trim() });
    if (meta.stock_moved === true) facts.push({ label: "Stok", value: "Digeser" });
    else if (meta.stock_movement === "skipped" || meta.reason) facts.push({ label: "Stok", value: "Skip" });
    if (has("stock_issue_trigger")) facts.push({ label: "Trigger", value: String(meta.stock_issue_trigger) });
    if (has("items_count")) facts.push({ label: "Item", value: String(meta.items_count) });
    return facts;
  }

  // invoice.cancel
  if (actionLower === "invoice.cancel") {
    if (meta.stock_reversed === true) facts.push({ label: "Stok dikembalikan", value: "Ya" });
    if (has("reversal_lines")) facts.push({ label: "Baris reversal", value: String(meta.reversal_lines) });
    if (has("warehouse_id")) facts.push({ label: "Gudang", value: "Ya" });
    return facts;
  }

  // purchase_order.create
  if (actionLower === "purchase_order.create") {
    if (has("subtotal")) facts.push({ label: "Total", value: formatRupiah(num("subtotal")) });
    if (has("items_count")) facts.push({ label: "Item", value: String(meta.items_count) });
    if (has("vendor_name")) facts.push({ label: "Vendor", value: String(meta.vendor_name).trim() });
    return facts;
  }

  // po.delete
  if (actionLower === "po.delete") {
    if (has("po_number")) facts.push({ label: "PO", value: String(meta.po_number) });
    return facts;
  }

  // delivery_note.post
  if (actionLower === "delivery_note.post") {
    if (has("items_count")) facts.push({ label: "Item", value: String(meta.items_count) });
    if (meta.stock_moved === true) facts.push({ label: "Stok", value: "Digeser" });
    else if (meta.stock_movement === "skipped") facts.push({ label: "Stok", value: "Skip" });
    if (has("warehouse_id")) facts.push({ label: "Gudang", value: "Ya" });
    return facts;
  }

  // delivery_note.cancel
  if (actionLower === "delivery_note.cancel") {
    if (has("reversal_lines")) facts.push({ label: "Baris reversal", value: String(meta.reversal_lines) });
    if (meta.stock_reversed === true) facts.push({ label: "Stok dikembalikan", value: "Ya" });
    if (has("warehouse_id")) facts.push({ label: "Gudang", value: "Ya" });
    return facts;
  }

  // payment.* (future or if present)
  if (actionLower.startsWith("payment.") && has("amount")) {
    facts.push({ label: "Jumlah", value: formatRupiah(num("amount")) });
    return facts;
  }

  // product.*
  if (actionLower === "product.create" && meta.name) facts.push({ label: "Nama", value: String(meta.name) });
  if (actionLower === "product.create" && meta.sku) facts.push({ label: "SKU", value: String(meta.sku) });
  if (actionLower === "product.update" && meta.after) {
    const a = meta.after as any;
    if (a?.name) facts.push({ label: "Nama", value: String(a.name) });
    if (a?.sku) facts.push({ label: "SKU", value: String(a.sku) });
  }
  if (actionLower === "product.delete" && meta.before) {
    const b = meta.before as any;
    if (b?.name) facts.push({ label: "Nama", value: String(b.name) });
  }

  return facts;
}

const entityBadgeStyle = (): React.CSSProperties => ({
  padding: "2px 8px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 700,
  background: "#f1f5f9",
  color: "#475569",
  border: "1px solid #e2e8f0",
});

const actionBadgeStyle = (action: string): React.CSSProperties => {
  const a = (action || "").toLowerCase();
  const green = ["create", "receive", "sent", "post"];
  const blue = ["update"];
  const red = ["delete", "cancel", "deactivate"];
  let bg = "#f1f5f9";
  let color = "#475569";
  let border = "#e2e8f0";
  if (green.some((x) => a.includes(x))) {
    bg = "#ecfdf5";
    color = "#065f46";
    border = "#a7f3d0";
  } else if (blue.some((x) => a.includes(x))) {
    bg = "#eff6ff";
    color = "#1e40af";
    border = "#93c5fd";
  } else if (red.some((x) => a.includes(x))) {
    bg = "#fef2f2";
    color = "#991b1b";
    border = "#fecaca";
  }
  return {
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    background: bg,
    color,
    border: `1px solid ${border}`,
  };
};

type LogItem = {
  id: string;
  created_at: string;
  actor_role?: string | null;
  action: string;
  entity_type?: string | null;
  summary?: string | null;
  meta?: unknown;
};

export default function ActivityFeedClient({ logs }: { logs: LogItem[] }) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("7d");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => filterLogs(logs, timeFilter), [logs, timeFilter]);

  const filters: { key: TimeFilter; label: string }[] = [
    { key: "today", label: "Hari ini" },
    { key: "7d", label: "7 hari terakhir" },
    { key: "30d", label: "30 hari terakhir" },
    { key: "all", label: "Semua" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>Periode:</span>
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTimeFilter(key)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: timeFilter === key ? "1px solid #0f172a" : "1px solid #e2e8f0",
              background: timeFilter === key ? "#0f172a" : "white",
              color: timeFilter === key ? "white" : "#475569",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 4 }}>
          {filtered.length} aktivitas
        </span>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: "#64748b",
            background: "#f8fafc",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
          }}
        >
          Tidak ada aktivitas dalam periode ini.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((l) => {
            const entityLabel = getEntityLabel(l.action);
            const actionLabel = getActionLabel(l.action);
            const isExpanded = expandedId === l.id;
            const hasMeta =
              l.meta != null &&
              typeof l.meta === "object" &&
              Object.keys(l.meta as object).length > 0;
            const facts = extractFacts(l.action, l.meta);

            return (
              <div
                key={l.id}
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "14px 16px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", lineHeight: 1.4 }}>
                  {l.summary || "—"}
                </div>
                {facts.length > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {facts.map((f, i) => (
                      <span
                        key={i}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 8px",
                          borderRadius: 6,
                          background: "#f1f5f9",
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                          color: "#475569",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "#64748b", marginRight: 4 }}>
                          {f.label}:
                        </span>
                        <span style={{ fontWeight: 700, color: "#0f172a" }}>{f.value}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={entityBadgeStyle()}>{entityLabel}</span>
                  <span style={actionBadgeStyle(l.action)}>{actionLabel}</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>·</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{formatTime(l.created_at)}</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>·</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{l.actor_role || "—"}</span>
                </div>
                {hasMeta && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : l.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        color: "#64748b",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {isExpanded ? "Sembunyikan detail" : "Tampilkan detail"}
                    </button>
                    {isExpanded && (
                      <pre
                        style={{
                          marginTop: 10,
                          padding: 12,
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          fontSize: 12,
                          overflowX: "auto",
                          color: "#475569",
                          margin: 0,
                        }}
                      >
                        {JSON.stringify(l.meta, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
