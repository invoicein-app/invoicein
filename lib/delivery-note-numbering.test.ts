import { describe, expect, it } from "vitest";
import { isInvoiceDeliveryNoteDuplicateError, isSjNumberDuplicateError } from "./delivery-note-numbering";

describe("delivery-note-numbering errors", () => {
  it("detects sj_number duplicate", () => {
    expect(
      isSjNumberDuplicateError({
        message: 'duplicate key value violates unique constraint "delivery_notes_sj_number_unique"',
      })
    ).toBe(true);
  });

  it("detects invoice-linked duplicate", () => {
    expect(
      isInvoiceDeliveryNoteDuplicateError({
        message: 'duplicate key value violates unique constraint "delivery_notes_org_invoice_uniq"',
      })
    ).toBe(true);
  });
});
