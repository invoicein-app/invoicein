// lib/auth/internal-email.ts
export function normalizeUsername(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, ""); // aman buat email
}

export function normalizeOrgCode(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function makeInternalEmail(username: string, orgCode: string) {
  return `${normalizeUsername(username)}+${normalizeOrgCode(orgCode)}@invoiceku.local`;
}