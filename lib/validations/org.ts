import { z } from "zod";

export const updateOrgProfileBodySchema = z.object({
  name: z.string().optional().default(""),
  address: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  bank_name: z.string().optional().default(""),
  bank_account: z.string().optional().default(""),
  bank_account_name: z.string().optional().default(""),
  invoice_footer: z.string().optional().default(""),
  public_document_code: z.string().optional().default(""),
  invoice_prefix: z.string().optional().default("INV"),
  po_prefix: z.string().optional().default("PO"),
  quotation_prefix: z.string().optional().default("QUO"),
});
