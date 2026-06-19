import { describe, expect, it } from "vitest";
import { createDeliveryNoteFromInvoiceBodySchema } from "@/lib/validations/delivery-note";

describe("createDeliveryNoteFromInvoiceBodySchema", () => {
  const invoiceId = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts invoice id only", () => {
    const parsed = createDeliveryNoteFromInvoiceBodySchema.parse({ invoiceId });
    expect(parsed.invoiceId).toBe(invoiceId);
    expect(parsed.note).toBe("");
  });

  it("accepts sj_date and note", () => {
    const parsed = createDeliveryNoteFromInvoiceBodySchema.parse({
      invoiceId,
      sj_date: "2026-06-02",
      note: "Kirim pagi",
    });
    expect(parsed.sj_date).toBe("2026-06-02");
    expect(parsed.note).toBe("Kirim pagi");
  });
});
