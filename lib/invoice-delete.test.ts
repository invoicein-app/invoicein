import { describe, expect, it } from "vitest";
import {
  assessInvoiceDeletableFromSets,
  formatInvoiceDeleteBlockedMessage,
} from "@/lib/invoice-delete";

describe("assessInvoiceDeletableFromSets", () => {
  const baseInvoice = { id: "inv-1", status: "sent", amount_paid: 0 };

  it("allows delete when linked delivery note exists and no payment", () => {
    const result = assessInvoiceDeletableFromSets({
      invoice: baseInvoice,
      invoiceIdsWithPayments: new Set(),
      invoiceIdsWithDeliveryNotes: new Set(["inv-1"]),
    });
    expect(result.canDelete).toBe(true);
    expect(result.blockers).not.toContain("delivery_note");
  });

  it("blocks delete when payment exists", () => {
    const result = assessInvoiceDeletableFromSets({
      invoice: { ...baseInvoice, amount_paid: 50000 },
      invoiceIdsWithPayments: new Set(["inv-1"]),
      invoiceIdsWithDeliveryNotes: new Set(["inv-1"]),
    });
    expect(result.canDelete).toBe(false);
    expect(result.blockers).toContain("paid");
  });

  it("blocks delete for partial payment via amount_paid", () => {
    const result = assessInvoiceDeletableFromSets({
      invoice: { ...baseInvoice, amount_paid: 1 },
      invoiceIdsWithPayments: new Set(),
      invoiceIdsWithDeliveryNotes: new Set(),
    });
    expect(result.canDelete).toBe(false);
    expect(result.blockers).toContain("paid");
  });
});

describe("formatInvoiceDeleteBlockedMessage", () => {
  it("mentions removing payments first", () => {
    const msg = formatInvoiceDeleteBlockedMessage(["Invoice sudah memiliki pembayaran."]);
    expect(msg.toLowerCase()).toContain("pembayaran");
  });
});
