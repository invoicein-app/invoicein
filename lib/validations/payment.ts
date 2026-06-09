import { z } from "zod";
import { isoDateSchema, moneyIntSchema } from "./common";

export const recordInvoicePaymentBodySchema = z.object({
  paid_at: isoDateSchema,
  amount: moneyIntSchema.refine((n) => n > 0, "Nominal harus lebih dari 0"),
  note: z.string().optional().default(""),
});

export type RecordInvoicePaymentBody = z.infer<typeof recordInvoicePaymentBodySchema>;

export const updateInvoicePaymentBodySchema = z
  .object({
    amount: moneyIntSchema.optional(),
    paid_at: isoDateSchema.optional(),
    note: z.union([z.string(), z.null()]).optional(),
  })
  .refine(
    (data) =>
      data.amount !== undefined || data.paid_at !== undefined || data.note !== undefined,
    { message: "Tidak ada field untuk diupdate." }
  );

export type UpdateInvoicePaymentBody = z.infer<typeof updateInvoicePaymentBodySchema>;

export const addInvoicePaymentBodySchema = z.object({
  invoiceId: z.string().uuid("invoiceId tidak valid"),
  amount: moneyIntSchema.refine((n) => n > 0, "amount harus > 0"),
});

export type AddInvoicePaymentBody = z.infer<typeof addInvoicePaymentBodySchema>;
