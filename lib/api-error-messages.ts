/** Map raw API/DB errors to clearer Indonesian messages for the UI. */
export function formatApiErrorMessage(raw: string | null | undefined): string {
  const msg = String(raw ?? "").trim();
  if (!msg) return "Terjadi kesalahan. Silakan coba lagi.";

  const lower = msg.toLowerCase();

  if (lower.includes("no organization found for this user")) {
    return "Akun belum terhubung ke organisasi. Logout lalu login lagi. Jika masih gagal, hubungi admin organisasi.";
  }

  if (lower.includes("kamu belum punya organisasi aktif")) {
    return "Akun belum punya organisasi aktif. Logout lalu login lagi sebagai admin/owner.";
  }

  if (lower.includes("unauthorized") || lower.includes("jwt")) {
    return "Sesi login sudah habis. Silakan logout lalu login lagi.";
  }

  if (lower.includes("supabase_service_role_key")) {
    return "Server belum dikonfigurasi lengkap (service role). Hubungi admin sistem.";
  }

  if (lower.includes("service role tidak tersedia")) {
    return "Server belum dikonfigurasi lengkap. Hubungi admin sistem.";
  }

  if (lower.includes("langganan organisasi sudah berakhir")) {
    return msg;
  }

  return msg;
}
