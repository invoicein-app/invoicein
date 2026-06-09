import { z } from "zod";

const requiredText = (label: string) => z.string().trim().min(1, `${label} wajib diisi.`);

export const createBankAccountBodySchema = z.object({
  bank_name: requiredText("Nama bank"),
  account_number: requiredText("Nomor rekening"),
  account_holder_name: requiredText("Atas nama"),
  branch: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      const s = String(v ?? "").trim();
      return s || null;
    }),
  is_active: z.boolean().optional().default(true),
  is_default: z.boolean().optional().default(false),
});

export type CreateBankAccountBody = z.infer<typeof createBankAccountBodySchema>;

export const updateBankAccountBodySchema = z
  .object({
    bank_name: requiredText("Nama bank").optional(),
    account_number: requiredText("Nomor rekening").optional(),
    account_holder_name: requiredText("Atas nama").optional(),
    branch: z.union([z.string(), z.null()]).optional(),
    is_active: z.boolean().optional(),
    is_default: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "Tidak ada field untuk diupdate." }
  );

export type UpdateBankAccountBody = z.infer<typeof updateBankAccountBodySchema>;
