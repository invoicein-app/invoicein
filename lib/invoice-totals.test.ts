import { describe, expect, it } from "vitest";
import {
  calcInvoiceTotals,
  computeInvoiceSaveTotals,
  lineAmountRupiah,
  moneyInt,
  paidSalesTotalForMonth,
} from "@/lib/invoice-totals";

describe("moneyInt", () => {
  it("rounds to whole Rupiah and clamps negative to 0", () => {
    expect(moneyInt(1500.4)).toBe(1500);
    expect(moneyInt(1500.6)).toBe(1501);
    expect(moneyInt(-10)).toBe(0);
  });
});

describe("lineAmountRupiah", () => {
  it("supports decimal qty without float artifacts", () => {
    expect(lineAmountRupiah(1.5, 100_000)).toBe(150_000);
    expect(lineAmountRupiah("2.5", "200000")).toBe(500_000);
  });

  it("returns 0 for invalid qty or price", () => {
    expect(lineAmountRupiah("x", 1000)).toBe(0);
    expect(lineAmountRupiah(1, null)).toBe(0);
  });
});

describe("computeInvoiceSaveTotals", () => {
  it("calculates subtotal, percent discount, tax, and total", () => {
    const result = computeInvoiceSaveTotals({
      items: [
        { qty: 2, price: 100_000 },
        { qty: 1.5, price: 200_000 },
      ],
      discountType: "percent",
      discountValue: 10,
      taxPercent: 11,
    });

    expect(result.subtotal).toBe(500_000);
    expect(result.discountAmount).toBe(50_000);
    expect(result.taxAmount).toBe(49_500);
    expect(result.total).toBe(499_500);
  });

  it("caps amount discount to subtotal", () => {
    const result = computeInvoiceSaveTotals({
      items: [{ qty: 1, price: 100_000 }],
      discountType: "amount",
      discountValue: 250_000,
      taxPercent: 0,
    });

    expect(result.discountAmount).toBe(100_000);
    expect(result.total).toBe(0);
  });
});

describe("calcInvoiceTotals", () => {
  it("derives pay state from amount paid", () => {
    const unpaid = calcInvoiceTotals({
      discount_value: 0,
      tax_value: 0,
      amount_paid: 0,
      invoice_items: [{ qty: 1, price: 100_000 }],
    });
    expect(unpaid.payState).toBe("UNPAID");
    expect(unpaid.remaining).toBe(100_000);

    const partial = calcInvoiceTotals({
      discount_value: 0,
      tax_value: 0,
      amount_paid: 40_000,
      invoice_items: [{ qty: 1, price: 100_000 }],
    });
    expect(partial.payState).toBe("PARTIAL");
    expect(partial.remaining).toBe(60_000);

    const paid = calcInvoiceTotals({
      discount_value: 0,
      tax_value: 0,
      amount_paid: 100_000,
      invoice_items: [{ qty: 1, price: 100_000 }],
    });
    expect(paid.payState).toBe("PAID");
    expect(paid.remaining).toBe(0);
  });
});

describe("paidSalesTotalForMonth", () => {
  it("sums only PAID invoices in the target month", () => {
    const total = paidSalesTotalForMonth(
      [
        {
          invoice_date: "2026-06-15",
          discount_value: 0,
          tax_value: 0,
          amount_paid: 100_000,
          invoice_items: [{ qty: 1, price: 100_000 }],
        },
        {
          invoice_date: "2026-06-20",
          discount_value: 0,
          tax_value: 0,
          amount_paid: 50_000,
          invoice_items: [{ qty: 1, price: 100_000 }],
        },
        {
          invoice_date: "2026-05-30",
          discount_value: 0,
          tax_value: 0,
          amount_paid: 200_000,
          invoice_items: [{ qty: 1, price: 200_000 }],
        },
      ],
      "2026-06"
    );

    expect(total).toBe(100_000);
  });
});
