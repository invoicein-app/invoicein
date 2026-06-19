import { z } from "zod";
import { isoDateOptionalSchema, positiveQtySchema, uuidOptionalSchema } from "./common";

export const deliveryNoteItemSchema = z.object({
  name: z.string().trim().min(1),
  qty: positiveQtySchema,
  unit: z.union([z.string(), z.null(), z.undefined()]).optional(),
  product_id: uuidOptionalSchema.optional(),
  item_key: z.union([z.string(), z.null(), z.undefined()]).optional(),
});

export const createDeliveryNoteBodySchema = z
  .object({
    sj_date: isoDateOptionalSchema.optional(),
    shipping_address: z.string().trim().min(1, "Alamat pengiriman wajib diisi."),
    driver_name: z.string().optional().default(""),
    note: z.string().optional().default(""),
    warehouse_id: uuidOptionalSchema.optional(),
    customer_id: uuidOptionalSchema.optional(),
    customer_name: z.string().optional().default(""),
    customer_phone: z.union([z.string(), z.null(), z.undefined()]).optional(),
    invoice_id: uuidOptionalSchema.optional(),
    items: z.array(deliveryNoteItemSchema).optional().default([]),
  })
  .transform((data) => ({
    ...data,
    items: (data.items || [])
      .map((row, i) => ({
        name: row.name.trim(),
        qty: row.qty,
        unit: String(row.unit ?? "").trim() || null,
        product_id: row.product_id,
        item_key: String(row.item_key ?? "").trim() || null,
        sort_order: i,
      }))
      .filter((row) => row.name && row.qty > 0),
  }))
  .refine((data) => data.items.length > 0, {
    message: "Minimal satu item dengan nama dan qty lebih dari 0.",
  });

export type CreateDeliveryNoteBody = z.infer<typeof createDeliveryNoteBodySchema>;

export const createDeliveryNoteFromInvoiceBodySchema = z.object({
  invoiceId: z.string().uuid("invoiceId tidak valid"),
  sj_date: isoDateOptionalSchema.optional(),
  note: z.string().optional().default(""),
});
