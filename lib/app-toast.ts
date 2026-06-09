import { toast } from "sonner";

export function toastSuccess(message: string, description?: string) {
  toast.success(message, description ? { description } : undefined);
}

export function toastError(message: string, description?: string) {
  toast.error(message, description ? { description } : undefined);
}

export function toastInfo(message: string, description?: string) {
  toast.info(message, description ? { description } : undefined);
}

/** Map inline form messages (often with emoji) to toast. */
export function toastFromMsg(msg: string) {
  const text = String(msg || "").trim();
  if (!text) return;
  const lower = text.toLowerCase();
  if (lower.includes("gagal") || lower.includes("error") || lower.includes("wajib")) {
    toastError(text.replace(/\s*✅\s*/g, "").trim());
    return;
  }
  if (text.includes("✅") || lower.includes("tersimpan") || lower.includes("berhasil")) {
    toastSuccess(text.replace(/\s*✅\s*/g, " ").trim());
    return;
  }
  toastInfo(text);
}
