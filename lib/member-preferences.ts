import { createClient } from "@supabase/supabase-js";
import { getAppOrg } from "@/lib/auth/get-app-org";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export type BookkeepingPreferenceResult =
  | { ok: true; show_invoice_bookkeeping_status: boolean }
  | { ok: false; error: string };

export async function loadBookkeepingPreference(
  userId: string,
  orgId: string
): Promise<BookkeepingPreferenceResult> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("memberships")
    .select("id, show_invoice_bookkeeping_status")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    if (/show_invoice_bookkeeping_status/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Kolom preferensi belum ada di database. Jalankan migration 20260605120000_add_invoice_bookkeeping_status.sql di Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "Membership aktif tidak ditemukan untuk organisasi ini." };
  }

  return {
    ok: true,
    show_invoice_bookkeeping_status: Boolean(data.show_invoice_bookkeeping_status),
  };
}

export async function saveBookkeepingPreference(
  userId: string,
  orgId: string,
  enabled: boolean
): Promise<BookkeepingPreferenceResult> {
  const admin = adminClient();
  const { data: updated, error } = await admin
    .from("memberships")
    .update({ show_invoice_bookkeeping_status: enabled })
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("is_active", true)
    .select("id, show_invoice_bookkeeping_status")
    .maybeSingle();

  if (error) {
    if (/show_invoice_bookkeeping_status/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Kolom preferensi belum ada di database. Jalankan migration 20260605120000_add_invoice_bookkeeping_status.sql di Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }

  if (!updated) {
    return { ok: false, error: "Membership aktif tidak ditemukan. Preferensi tidak tersimpan." };
  }

  return {
    ok: true,
    show_invoice_bookkeeping_status: Boolean(updated.show_invoice_bookkeeping_status),
  };
}

export async function getShowInvoiceBookkeepingStatus(): Promise<boolean> {
  const org = await getAppOrg();
  if (!org.ok) return false;

  const result = await loadBookkeepingPreference(org.userId, org.orgId);
  if (!result.ok) return false;
  return result.show_invoice_bookkeeping_status;
}
