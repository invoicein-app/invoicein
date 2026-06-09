import { z } from "zod";

const optionalPhone = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    const s = String(v ?? "").trim();
    return s || null;
  });

export const createWarehouseBodySchema = z.object({
  name: z.string().trim().min(1, "Nama gudang wajib diisi."),
  address: z.string().trim().min(1, "Alamat wajib diisi."),
  phone: optionalPhone,
  is_active: z.boolean().optional().default(true),
});

export type CreateWarehouseBody = z.infer<typeof createWarehouseBodySchema>;

export const updateWarehouseBodySchema = z
  .object({
    name: z.string().trim().min(1, "Nama gudang wajib diisi.").optional(),
    address: z.string().trim().min(1, "Alamat wajib diisi.").optional(),
    phone: z.union([z.string(), z.null()]).optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "Tidak ada field untuk diupdate." }
  );

export type UpdateWarehouseBody = z.infer<typeof updateWarehouseBodySchema>;
