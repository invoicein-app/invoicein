import { z } from "zod";
import { isoDateSchema, isoDateOptionalSchema, moneyIntSchema, uuidOptionalSchema } from "./common";

export const manualEntryTypeSchema = z.enum(["receivable", "payable"], {
  message: "Jenis entri tidak valid.",
});

export const partySourceTypeSchema = z.enum(["customer", "vendor", "other"], {
  message: "Sumber pihak tidak valid.",
});

const notesSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    const s = String(v ?? "").trim();
    return s || null;
  });

export const createManualLedgerBodySchema = z
  .object({
    entry_type: manualEntryTypeSchema,
    party_source_type: partySourceTypeSchema.optional().default("other"),
    entry_date: isoDateSchema,
    due_date: isoDateOptionalSchema.optional(),
    description: z.string().trim().min(1, "Deskripsi wajib diisi."),
    total_amount: moneyIntSchema.refine((n) => n > 0, "Nominal total harus > 0."),
    paid_amount: moneyIntSchema.optional().default(0),
    notes: notesSchema.optional(),
    customer_id: uuidOptionalSchema.optional(),
    vendor_id: uuidOptionalSchema.optional(),
    party_name: z.string().optional(),
  })
  .refine((d) => d.paid_amount <= d.total_amount, {
    message: "Jumlah dibayar tidak boleh melebihi total.",
  });

export const updateManualLedgerBodySchema = z
  .object({
    entry_date: isoDateSchema.optional(),
    description: z.string().trim().min(1, "Deskripsi wajib diisi.").optional(),
    total_amount: moneyIntSchema.refine((n) => n > 0, "Nominal total harus > 0.").optional(),
    paid_amount: moneyIntSchema.optional(),
    due_date: isoDateOptionalSchema.optional(),
    notes: z.union([z.string(), z.null()]).optional(),
    party_source_type: partySourceTypeSchema.optional(),
    customer_id: uuidOptionalSchema.optional(),
    vendor_id: uuidOptionalSchema.optional(),
    party_name: z.string().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Tidak ada field untuk diupdate.",
  });
