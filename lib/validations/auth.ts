import { z } from "zod";
import { isoDateOptionalSchema, moneyIntSchema, percentSchema } from "./common";

export const loginOrgBodySchema = z.object({
  org_code: z.string().trim().min(1, "org_code wajib"),
  username: z.string().trim().min(1, "username wajib"),
  password: z.string().min(1, "password wajib"),
});

export const forgotPasswordBodySchema = z.object({
  email: z.string().trim().min(1, "Email wajib diisi."),
});

const legacyInvoiceHeaderSchema = z.object({
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  customer_address: z.string().optional(),
  note: z.string().optional(),
  invoice_date: isoDateOptionalSchema.optional(),
  invoice_number: z.string().optional(),
  discount_value: percentSchema.optional(),
  tax_value: percentSchema.optional(),
  status: z.string().optional(),
});

const legacyInvoiceItemSchema = z.object({
  name: z.string().trim().min(1, "Item name wajib"),
  qty: z.coerce.number().finite("Item qty invalid"),
  price: moneyIntSchema,
  sort_order: z.coerce.number().finite().optional(),
});

export const legacyAuthInvoiceUpdateBodySchema = z.object({
  invoiceId: z.string().uuid("invoiceId wajib"),
  header: legacyInvoiceHeaderSchema.optional().default({}),
  items: z.array(legacyInvoiceItemSchema).min(1, "items wajib (minimal 1)"),
});

export const legacyAuthInvoicePatchBodySchema = z.object({
  invoice: legacyInvoiceHeaderSchema.optional(),
  header: legacyInvoiceHeaderSchema.optional(),
  items: z.array(legacyInvoiceItemSchema).min(1, "items wajib (minimal 1)"),
});
