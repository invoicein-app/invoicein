import { z } from "zod";

export function zodErrorMessage(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "Data tidak valid.";
  if (first.path.length === 0) return first.message;
  return `${first.path.join(".")}: ${first.message}`;
}

export const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

export const isoDateOptionalSchema = z
  .union([isoDateSchema, z.literal(""), z.null(), z.undefined()])
  .transform((v) => {
    const s = String(v ?? "").trim();
    return s || null;
  });

export const uuidOptionalSchema = z
  .union([z.string().uuid(), z.literal(""), z.null(), z.undefined()])
  .transform((v) => {
    const s = String(v ?? "").trim();
    return s || null;
  });

export const discountTypeSchema = z
  .union([
    z.enum(["percent", "amount", "percentage", "fixed"]),
    z.literal(""),
    z.null(),
    z.undefined(),
  ])
  .transform((v) => {
    const raw = String(v ?? "percent").trim().toLowerCase();
    if (raw === "amount" || raw === "fixed") return "amount" as const;
    return "percent" as const;
  });

export const percentSchema = z.coerce
  .number()
  .finite("Nilai persen tidak valid")
  .min(0)
  .max(100)
  .transform((n) => Math.floor(n));

export const moneyIntSchema = z.coerce
  .number()
  .finite("Nominal tidak valid")
  .min(0)
  .transform((n) => Math.floor(n));

/** Qty invoice — boleh desimal (mis. 156.17 kg). */
export const positiveQtySchema = z.coerce
  .number()
  .finite("Qty tidak valid")
  .positive("Qty harus lebih dari 0");

/** Qty quotation/PO — bilangan bulat. */
export const positiveIntQtySchema = z.coerce
  .number()
  .finite("Qty tidak valid")
  .positive("Qty harus lebih dari 0")
  .transform((n) => Math.floor(n));
