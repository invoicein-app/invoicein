import { z } from "zod";
import { moneyIntSchema } from "./common";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    const s = String(v ?? "").trim();
    return s || null;
  });

export const createProductBodySchema = z.object({
  name: z.string().trim().min(1, "Nama barang wajib."),
  sku: optionalText,
  unit: optionalText,
  price: moneyIntSchema.optional().default(0),
  is_active: z.boolean().optional().default(true),
});

export const updateProductBodySchema = z
  .object({
    id: z.string().uuid("Missing id"),
    name: z.string().trim().min(1, "Nama barang wajib.").optional(),
    sku: optionalText.optional(),
    unit: optionalText.optional(),
    price: moneyIntSchema.optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.sku !== undefined ||
      data.unit !== undefined ||
      data.price !== undefined ||
      data.is_active !== undefined,
    { message: "Tidak ada field untuk diupdate." }
  );
