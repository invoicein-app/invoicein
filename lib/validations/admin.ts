import { z } from "zod";

export const updateBillingBodySchema = z
  .object({
    org_id: z.string().uuid("org_id wajib diisi."),
    subscription_plan: z.enum(["basic", "standard"]).optional(),
    subscription_status: z
      .enum(["trial", "active", "grace_period", "expired", "cancelled"])
      .optional(),
    expires_at: z.union([z.string(), z.literal(""), z.null()]).optional(),
  })
  .refine(
    (data) =>
      data.subscription_plan !== undefined ||
      data.subscription_status !== undefined ||
      data.expires_at !== undefined,
    { message: "Tidak ada field yang di-update." }
  );

export const extendSubscriptionBodySchema = z.object({
  org_code: z.string().trim().min(1, "org_code wajib diisi."),
});

export const resolvePaymentConfirmationBodySchema = z.object({
  status: z.enum(["confirmed", "rejected"], {
    message: "status harus confirmed atau rejected.",
  }),
  admin_note: z.union([z.string(), z.null()]).optional(),
});

export const confirmSubscriptionPaymentBodySchema = z.object({
  org_id: z.string().uuid("org_id wajib diisi."),
  target_package: z.enum(["basic", "standard"], {
    message: "Paket target harus basic atau standard.",
  }),
  sender_account_name: z.string().trim().min(1, "Nama rekening pengirim wajib diisi."),
  sender_bank: z.string().trim().min(1, "Bank pengirim wajib diisi."),
  sender_account_number: z.string().trim().min(1, "Nomor rekening pengirim wajib diisi."),
  transfer_amount: z.string().trim().min(1, "Nominal transfer wajib diisi."),
  transfer_date: z.string().trim().min(1, "Tanggal transfer wajib diisi."),
  note: z.union([z.string(), z.null()]).optional(),
});
