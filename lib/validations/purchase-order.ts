import { z } from "zod";
import {
  isoDateOptionalSchema,
  moneyIntSchema,
  positiveIntQtySchema,
  uuidOptionalSchema,
} from "./common";

export const purchaseOrderItemInputSchema = z.object({
  product_id: z.string().uuid("Product wajib dipilih dari master barang."),
  name: z.string().trim().min(1, "Nama item wajib diisi."),
  item_key: z.string().trim().min(1, "Item key wajib diisi."),
  qty: positiveIntQtySchema,
  price: moneyIntSchema,
  unit: z.union([z.string(), z.null(), z.undefined()]).optional(),
});

export const createPurchaseOrderBodySchema = z.object({
  po_date: isoDateOptionalSchema,
  vendor_id: uuidOptionalSchema,
  vendor_name: z.string().trim().min(1, "Nama vendor wajib."),
  vendor_phone: z.string().optional().default(""),
  vendor_address: z.string().optional().default(""),
  warehouse_id: z.string().uuid("Gudang tujuan wajib dipilih."),
  ship_to_name: z.string().optional().default(""),
  ship_to_phone: z.string().optional().default(""),
  ship_to_address: z.string().optional().default(""),
  note: z.string().optional().default(""),
  items: z.array(purchaseOrderItemInputSchema).min(1, "Minimal 1 item."),
});

export type CreatePurchaseOrderBody = z.infer<typeof createPurchaseOrderBodySchema>;

export const cancelPurchaseOrderBodySchema = z.object({
  reason: z.string().optional().default(""),
});

export const receivePurchaseOrderLineSchema = z.object({
  po_item_id: z.string().uuid("po_item_id tidak valid"),
  item_name: z.string().optional(),
  qty_received: positiveIntQtySchema,
  production_date: isoDateOptionalSchema.optional(),
  expired_date: isoDateOptionalSchema.optional(),
});

export const receivePurchaseOrderBodySchema = z
  .object({
    warehouse_id: z.string().uuid("warehouse_id wajib UUID"),
    sj_no: z.string().optional(),
    received_date: isoDateOptionalSchema.optional(),
    notes: z.string().optional(),
    lines: z.array(receivePurchaseOrderLineSchema).min(1, "Lines kosong"),
  })
  .transform((data) => ({
    ...data,
    lines: data.lines
      .map((line) => ({
        ...line,
        item_name: String(line.item_name || "").trim(),
      }))
      .filter((line) => line.qty_received > 0),
  }))
  .refine((data) => data.lines.length > 0, {
    message: "Minimal 1 item qty_received > 0",
  });

export type ReceivePurchaseOrderBody = z.infer<typeof receivePurchaseOrderBodySchema>;
