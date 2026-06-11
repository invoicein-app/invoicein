"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSubmitGuard } from "../components/use-submit-guard";
import { toastError, toastSuccess } from "@/lib/app-toast";

const TEAL = "#2D7D71";
const BORDER = "#E2E8F0";

function parseFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return "invoice-list.xlsx";
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return utf8[1];
    }
  }
  const plain = /filename="([^"]+)"/i.exec(contentDisposition);
  if (plain?.[1]) return plain[1];
  return "invoice-list.xlsx";
}

export default function InvoiceExportClient() {
  const sp = useSearchParams();
  const [exporting, setExporting] = useState(false);
  const { tryBegin, end, isBlocked } = useSubmitGuard(setExporting);

  async function handleExport() {
    if (isBlocked()) return;
    if (!tryBegin()) return;

    try {
      const params = new URLSearchParams();
      const inv = sp.get("inv");
      const custId = sp.get("custId");
      const pay = sp.get("pay");
      const from = sp.get("from");
      const to = sp.get("to");

      if (inv) params.set("inv", inv);
      if (custId) params.set("custId", custId);
      if (pay) params.set("pay", pay);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const qs = params.toString();
      const url = qs ? `/api/invoice/export?${qs}` : "/api/invoice/export";

      const res = await fetch(url, { method: "GET", credentials: "include" });

      if (!res.ok) {
        let message = "Gagal mengekspor invoice";
        try {
          const json = await res.json();
          if (json?.error) message = String(json.error);
        } catch {
          /* ignore */
        }
        toastError(message);
        return;
      }

      const blob = await res.blob();
      const filename = parseFilename(res.headers.get("Content-Disposition"));
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      toastSuccess("Export Excel berhasil");
    } catch {
      toastError("Gagal mengekspor invoice");
    } finally {
      end();
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 8,
        border: `1px solid ${TEAL}`,
        background: exporting ? "#f0fdfa" : "#fff",
        color: TEAL,
        fontWeight: 800,
        fontSize: 13,
        cursor: exporting ? "wait" : "pointer",
        opacity: exporting ? 0.75 : 1,
        whiteSpace: "nowrap",
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3v12M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 19h14" strokeLinecap="round" />
      </svg>
      {exporting ? "Mengekspor…" : "Export Excel"}
    </button>
  );
}
