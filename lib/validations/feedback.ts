import { z } from "zod";

export const feedbackCategorySchema = z.enum(["bug", "saran", "pertanyaan", "keluhan"], {
  message: "jenis feedback tidak valid.",
});

export const feedbackStatusSchema = z.enum(["new", "read", "processed", "done"], {
  message: "status tidak valid.",
});

export const submitFeedbackBodySchema = z.object({
  org_code: z.string().trim().min(1, "org_code wajib diisi."),
  category: feedbackCategorySchema,
  message: z.string().trim().min(1, "Pesan wajib diisi."),
  current_route: z.string().trim().min(1, "current_route wajib diisi."),
  name: z.string().optional(),
});

export const updateFeedbackStatusBodySchema = z.object({
  status: feedbackStatusSchema,
  admin_note: z.union([z.string(), z.null()]).optional(),
});
