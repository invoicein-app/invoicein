import { z } from "zod";
import { uuidOptionalSchema } from "./common";

export const createStaffBodySchema = z.object({
  orgId: uuidOptionalSchema.optional(),
  username: z.string().trim().min(1, "username wajib"),
  password: z.string().min(6, "password minimal 6 karakter"),
  role: z.enum(["staff", "admin"]).optional().default("staff"),
});

export const setMemberActiveBodySchema = z.object({
  memberId: z.string().uuid("memberId wajib"),
  isActive: z.boolean(),
});

export const resetMemberPasswordBodySchema = z.object({
  memberId: z.string().uuid("memberId wajib"),
  newPassword: z.string().min(6, "Password minimal 6 karakter"),
});

export const deleteStaffBodySchema = z.object({
  memberId: z.string().uuid("memberId wajib"),
});

export const memberPreferencesBodySchema = z.object({
  show_invoice_bookkeeping_status: z.boolean({
    message: "show_invoice_bookkeeping_status (boolean) wajib",
  }),
});
