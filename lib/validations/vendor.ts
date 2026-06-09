import { z } from "zod";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    const s = String(v ?? "").trim();
    return s || null;
  });

export const createVendorBodySchema = z.object({
  name: z.string().trim().min(1, "Vendor name wajib diisi."),
  vendor_code: optionalText,
  phone: optionalText,
  email: optionalText,
  address: optionalText,
  note: optionalText,
  is_active: z.boolean().optional().default(true),
});

export type CreateVendorBody = z.infer<typeof createVendorBodySchema>;

export const updateVendorBodySchema = z
  .object({
    vendor_code: optionalText.optional(),
    name: z.string().trim().min(1, "Vendor name wajib diisi.").optional(),
    phone: optionalText.optional(),
    email: optionalText.optional(),
    address: optionalText.optional(),
    note: optionalText.optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "Tidak ada field untuk diupdate." }
  );

export type UpdateVendorBody = z.infer<typeof updateVendorBodySchema>;

export const resolveUsersBodySchema = z.object({
  ids: z
    .array(z.string())
    .optional()
    .default([])
    .transform((arr) =>
      [...new Set(arr.filter((s) => z.string().uuid().safeParse(s).success))].slice(0, 80)
    ),
});
