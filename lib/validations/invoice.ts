import { z } from "zod";
import {
  discountTypeSchema,
  isoDateOptionalSchema,
  moneyIntSchema,
  percentSchema,
  positiveQtySchema,
  uuidOptionalSchema,
} from "./common";

export const invoiceItemInputSchema = z.object({
  product_id: uuidOptionalSchema,
  name: z.string().trim().min(1, "Nama item wajib diisi"),
  item_key: z.union([z.string(), z.null(), z.undefined()]).optional(),
  qty: positiveQtySchema,
  price: moneyIntSchema,
  unit: z.union([z.string(), z.null(), z.undefined()]).optional(),
});

export const createInvoiceBodySchema = z.object({
  invoice_date: isoDateOptionalSchema,
  due_date: isoDateOptionalSchema,
  quotation_id: uuidOptionalSchema,
  customer_id: uuidOptionalSchema,
  customer_name: z.string().trim().min(1, "Customer name wajib diisi."),
  customer_phone: z.string().optional().default(""),
  customer_address: z.string().optional().default(""),
  note: z.string().optional().default(""),
  discount_type: discountTypeSchema.optional(),
  discount_value: z.coerce.number().finite().min(0).optional().default(0),
  tax_value: percentSchema.optional().default(0),
  warehouse_id: uuidOptionalSchema,
  bank_account_id: z.union([z.string().uuid(), z.null()]).optional(),
  items: z.array(invoiceItemInputSchema).min(1, "Minimal 1 item."),
});

export type CreateInvoiceBody = z.infer<typeof createInvoiceBodySchema>;

export const updateInvoiceHeaderSchema = z.object({
  customer_id: uuidOptionalSchema.optional(),
  customer_name: z.string().trim().min(1, "Customer name wajib diisi.").optional(),
  customer_phone: z.string().optional(),
  customer_address: z.string().optional(),
  note: z.string().optional(),
  invoice_date: isoDateOptionalSchema.optional(),
  due_date: isoDateOptionalSchema.optional(),
  discount_type: discountTypeSchema.optional(),
  discount_value: z.coerce.number().finite().min(0).optional(),
  tax_value: percentSchema.optional(),
  warehouse_id: uuidOptionalSchema.optional(),
  bank_account_id: z.union([z.string().uuid(), z.null()]).optional(),
});

export const updateInvoiceBodySchema = z.object({
  header: updateInvoiceHeaderSchema.optional().default({}),
  items: z.array(invoiceItemInputSchema).min(1, "Minimal 1 item."),
});

export type UpdateInvoiceBody = z.infer<typeof updateInvoiceBodySchema>;

export const cancelInvoiceBodySchema = z.object({
  invoice_id: z.string().uuid("Invalid invoice id"),
});

export const invoiceBookkeepingBodySchema = z.object({
  bookkeeping_recorded: z.boolean({ message: "bookkeeping_recorded (boolean) wajib" }),
});
