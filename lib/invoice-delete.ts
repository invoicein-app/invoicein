import type { SupabaseClient } from "@supabase/supabase-js";
import { reverseInvoiceStockOut } from "@/lib/invoice-finalize";

export type InvoiceDeleteBlocker =
  | "cancelled"
  | "paid"
  | "payment_records"
  | "delivery_note"
  | "stock_reversal";

export type InvoiceDeleteAssessment = {
  canDelete: boolean;
  reasons: string[];
  blockers: InvoiceDeleteBlocker[];
  adminOverride?: boolean;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function isInvoiceDeleteAdmin(role?: string | null): boolean {
  return String(role || "").trim().toLowerCase() === "admin";
}

function applyDeleteAdminOverrides(
  assessment: InvoiceDeleteAssessment,
  actorRole?: string | null
): InvoiceDeleteAssessment {
  if (!isInvoiceDeleteAdmin(actorRole)) return assessment;

  const blockers = assessment.blockers.filter((b) => b !== "cancelled");
  const reasons = assessment.reasons.filter(
    (r) =>
      !r.includes("dibatalkan") &&
      !r.includes("batalkan invoice, bukan hapus") &&
      !r.includes("gunakan arsip cancel")
  );

  if (blockers.length === assessment.blockers.length) {
    return assessment;
  }

  return {
    canDelete: blockers.length === 0,
    reasons,
    blockers,
    adminOverride: true,
  };
}

export function assessInvoiceDeletableFromSets(args: {
  invoice: {
    id: string;
    status?: string | null;
    amount_paid?: number | null;
  };
  invoiceIdsWithPayments: Set<string>;
  invoiceIdsWithDeliveryNotes: Set<string>;
  actorRole?: string | null;
}): InvoiceDeleteAssessment {
  const reasons: string[] = [];
  const blockers: InvoiceDeleteBlocker[] = [];
  const invoiceId = String(args.invoice.id || "").trim();
  const status = String(args.invoice.status || "").toLowerCase();
  const amountPaid = Math.max(0, Math.floor(num(args.invoice.amount_paid)));

  if (status === "cancelled") {
    blockers.push("cancelled");
    reasons.push("Invoice sudah dibatalkan.");
  }
  if (status === "paid" || amountPaid > 0) {
    blockers.push("paid");
    reasons.push("Invoice sudah memiliki pembayaran.");
  }
  if (args.invoiceIdsWithPayments.has(invoiceId)) {
    blockers.push("payment_records");
    if (!reasons.some((r) => r.includes("pembayaran"))) {
      reasons.push("Invoice memiliki catatan pembayaran.");
    }
  }
  if (args.invoiceIdsWithDeliveryNotes.has(invoiceId)) {
    blockers.push("delivery_note");
    reasons.push("Invoice sudah memiliki surat jalan terkait.");
  }

  const uniqueBlockers = [...new Set(blockers)];
  const uniqueReasons = [...new Set(reasons)];
  return applyDeleteAdminOverrides(
    {
      canDelete: uniqueBlockers.length === 0,
      reasons: uniqueReasons,
      blockers: uniqueBlockers,
    },
    args.actorRole
  );
}

export async function assessInvoiceDeletable(args: {
  supabase: SupabaseClient;
  orgId: string;
  invoice: {
    id: string;
    status?: string | null;
    amount_paid?: number | null;
    quotation_id?: string | null;
  };
  actorRole?: string | null;
}): Promise<InvoiceDeleteAssessment> {
  const { supabase, orgId } = args;
  const invoiceId = String(args.invoice.id || "").trim();
  const reasons: string[] = [];
  const blockers: InvoiceDeleteBlocker[] = [];

  const status = String(args.invoice.status || "").toLowerCase();
  const amountPaid = Math.max(0, Math.floor(num(args.invoice.amount_paid)));

  if (status === "cancelled") {
    blockers.push("cancelled");
    reasons.push("Invoice sudah dibatalkan — gunakan arsip cancel, bukan hapus permanen.");
  }

  if (status === "paid" || amountPaid > 0) {
    blockers.push("paid");
    reasons.push("Invoice sudah memiliki pembayaran.");
  }

  const { count: paymentCount, error: payErr } = await supabase
    .from("invoice_payments")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId);

  if (payErr) {
    return { canDelete: false, reasons: [payErr.message], blockers: ["payment_records"] };
  }

  if ((paymentCount || 0) > 0) {
    blockers.push("payment_records");
    if (!reasons.some((r) => r.includes("pembayaran"))) {
      reasons.push("Invoice memiliki catatan pembayaran.");
    }
  }

  const { count: dnCount, error: dnErr } = await supabase
    .from("delivery_notes")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("invoice_id", invoiceId);

  if (dnErr) {
    return { canDelete: false, reasons: [dnErr.message], blockers: ["delivery_note"] };
  }

  if ((dnCount || 0) > 0) {
    blockers.push("delivery_note");
    reasons.push("Invoice sudah memiliki surat jalan terkait.");
  }

  const uniqueBlockers = [...new Set(blockers)];
  const uniqueReasons = [...new Set(reasons)];

  if (uniqueBlockers.length === 0) {
    return { canDelete: true, reasons: [], blockers: [] };
  }

  return applyDeleteAdminOverrides(
    {
      canDelete: false,
      reasons: uniqueReasons,
      blockers: uniqueBlockers,
    },
    args.actorRole
  );
}

export function formatInvoiceDeleteBlockedMessage(reasons: string[]): string {
  if (reasons.length === 0) {
    return "Invoice tidak bisa dihapus karena sudah memiliki pembayaran / surat jalan / relasi stok. Silakan batalkan invoice.";
  }
  return `Invoice tidak bisa dihapus: ${reasons.join(" ")} Silakan batalkan invoice jika perlu.`;
}

export async function deleteInvoiceSafely(args: {
  supabase: SupabaseClient;
  orgId: string;
  invoice: Record<string, unknown>;
  actorRole?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; assessment?: InvoiceDeleteAssessment }> {
  const { supabase, orgId } = args;
  const invoiceId = String(args.invoice.id || "").trim();
  if (!invoiceId) {
    return { ok: false, error: "Invoice id tidak valid." };
  }

  const status = String(args.invoice.status || "").toLowerCase();
  const isCancelled = status === "cancelled";

  const assessment = await assessInvoiceDeletable({
    supabase,
    orgId,
    invoice: {
      id: invoiceId,
      status,
      amount_paid: num(args.invoice.amount_paid),
      quotation_id: args.invoice.quotation_id ? String(args.invoice.quotation_id) : null,
    },
    actorRole: args.actorRole,
  });

  if (!assessment.canDelete) {
    return {
      ok: false,
      error: formatInvoiceDeleteBlockedMessage(assessment.reasons),
      assessment,
    };
  }

  const warehouseId = String(args.invoice.warehouse_id || "").trim();

  if (!isCancelled) {
    const stockReverse = await reverseInvoiceStockOut({
      supabase,
      orgId,
      invoiceId,
      reversalRefType: "INVOICE_CANCEL",
      warehouseFallback: warehouseId,
    });

    if (!stockReverse.ok) {
      return {
        ok: false,
        error: stockReverse.error,
        assessment: {
          canDelete: false,
          reasons: [stockReverse.error],
          blockers: ["stock_reversal"],
        },
      };
    }
  }

  await supabase
    .from("stock_ledger")
    .delete()
    .eq("org_id", orgId)
    .eq("ref_id", invoiceId);

  const { data: itemRows } = await supabase
    .from("invoice_items")
    .select("id")
    .eq("invoice_id", invoiceId);

  const itemIds = (itemRows || []).map((r: { id: string }) => String(r.id)).filter(Boolean);

  if (itemIds.length > 0) {
    await supabase
      .from("customer_item_latest_prices")
      .delete()
      .eq("org_id", orgId)
      .in("last_source_invoice_item_id", itemIds);
  }

  await supabase.from("invoice_payments").delete().eq("invoice_id", invoiceId);
  await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

  const quotationId = String(args.invoice.quotation_id || "").trim();
  if (quotationId) {
    await supabase
      .from("quotations")
      .update({
        invoice_id: null,
        is_locked: false,
        status: "accepted",
      })
      .eq("id", quotationId)
      .eq("org_id", orgId);
  }

  const { error: delInvErr } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("org_id", orgId);

  if (delInvErr) {
    return { ok: false, error: delInvErr.message };
  }

  return { ok: true };
}
