import { z } from "zod";

export const stockAdjustBodySchema = z.object({
  product_id: z.string().uuid("product_id wajib dipilih dari master barang."),
  qty_delta: z.coerce
    .number()
    .finite("qty_delta tidak valid")
    .refine((n) => Number.isInteger(n) && n !== 0, "qty_delta harus != 0"),
  note: z.union([z.string(), z.null()]).optional(),
});
