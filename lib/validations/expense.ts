import { z } from "zod";
import { EXPENSE_CATEGORIES, parseExpensePaymentMethodInput } from "@/lib/expense-categories";
import { isoDateOptionalSchema, isoDateSchema, moneyIntSchema } from "./common";

export const expenseCategorySchema = z.enum(
  EXPENSE_CATEGORIES as unknown as [string, ...string[]],
  { message: "Kategori tidak valid." }
);

const paymentMethodSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => parseExpensePaymentMethodInput(v));

const notesSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    const s = String(v ?? "").trim();
    return s || null;
  });

export const createExpenseBodySchema = z.object({
  expense_date: isoDateSchema,
  category: expenseCategorySchema,
  description: z.string().trim().min(1, "Deskripsi wajib diisi."),
  amount: moneyIntSchema.refine((n) => n > 0, "Nominal harus lebih dari 0."),
  payment_status: z.enum(["paid", "unpaid"]).optional().default("paid"),
  payment_method: paymentMethodSchema,
  notes: notesSchema,
});

export type CreateExpenseBody = z.infer<typeof createExpenseBodySchema>;

export const updateExpenseBodySchema = z
  .object({
    expense_date: isoDateSchema.optional(),
    category: expenseCategorySchema.optional(),
    description: z.string().trim().min(1, "Deskripsi wajib diisi.").optional(),
    amount: moneyIntSchema.refine((n) => n > 0, "Nominal harus lebih dari 0.").optional(),
    payment_status: z.enum(["paid", "unpaid"]).optional(),
    payment_method: z.union([z.string(), z.null()]).optional(),
    notes: z.union([z.string(), z.null()]).optional(),
  })
  .refine(
    (data) =>
      data.expense_date !== undefined ||
      data.category !== undefined ||
      data.description !== undefined ||
      data.amount !== undefined ||
      data.payment_status !== undefined ||
      data.payment_method !== undefined ||
      data.notes !== undefined,
    { message: "Tidak ada field untuk diupdate." }
  );

export type UpdateExpenseBody = z.infer<typeof updateExpenseBodySchema>;

export const createRecurringExpenseBodySchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi."),
  category: expenseCategorySchema,
  default_amount: z.coerce.number().finite().positive("Nominal default harus > 0."),
  frequency: z.enum(["daily", "weekly", "monthly"], { message: "Frekuensi tidak valid." }),
  due_day_of_month: z.union([z.coerce.number(), z.null(), z.undefined()]).optional(),
  due_day_of_week: z.union([z.coerce.number(), z.null(), z.undefined()]).optional(),
  is_active: z.boolean().optional(),
  notes: z.union([z.string(), z.null(), z.undefined()]).optional(),
});

export const updateRecurringExpenseBodySchema = z
  .object({
    name: z.string().trim().min(1, "Nama wajib diisi.").optional(),
    category: expenseCategorySchema.optional(),
    default_amount: z.coerce.number().finite().positive("Nominal default harus > 0.").optional(),
    frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
    due_day_of_month: z.union([z.coerce.number(), z.null()]).optional(),
    due_day_of_week: z.union([z.coerce.number(), z.null()]).optional(),
    is_active: z.boolean().optional(),
    notes: z.union([z.string(), z.null()]).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "Tidak ada field untuk diupdate." }
  );

export const createExpenseFromRecurringBodySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Format month: YYYY-MM")
    .optional(),
  week: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format week: YYYY-MM-DD")
    .optional(),
  date: isoDateOptionalSchema.optional(),
});
