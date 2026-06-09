import { z } from "zod";
import {
  discountTypeSchema,
  isoDateOptionalSchema,
  moneyIntSchema,
  percentSchema,
  positiveIntQtySchema,
  uuidOptionalSchema,
} from "./common";

export const quotationItemInputSchema = z.object({
  product_id: uuidOptionalSchema,
  name: z.string().trim().min(1, "Nama item tidak boleh kosong."),
  qty: positiveIntQtySchema,
  price: moneyIntSchema,
});

export const createQuotationBodySchema = z.object({
  quotation_date: isoDateOptionalSchema,
  customer_id: uuidOptionalSchema,
  customer_name: z.string().trim().min(1, "Customer name wajib diisi."),
  customer_phone: z.string().optional().default(""),
  customer_address: z.string().optional().default(""),
  note: z.string().optional().default(""),
  discount_type: discountTypeSchema.optional(),
  discount_value: z.coerce.number().finite().min(0).optional().default(0),
  tax_value: percentSchema.optional().default(0),
  items: z.array(quotationItemInputSchema).min(1, "Minimal 1 item."),
});

export type CreateQuotationBody = z.infer<typeof createQuotationBodySchema>;

/** Update quotation — same shape as create. */
export const updateQuotationBodySchema = createQuotationBodySchema;
export type UpdateQuotationBody = CreateQuotationBody;
