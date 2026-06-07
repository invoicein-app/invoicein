import type { SupabaseClient } from "@supabase/supabase-js";
import { invoiceItemToKey } from "@/lib/invoice-items";

export type OrgManualItem = {
  item_key: string;
  display_name: string;
  last_used_at?: string | null;
};

type ManualLineInput = {
  product_id?: string | null;
  name?: string | null;
  item_key?: string | null;
};

export async function upsertOrgManualItemsFromLines(args: {
  supabase: SupabaseClient;
  orgId: string;
  lines: ManualLineInput[];
}): Promise<void> {
  const { supabase, orgId, lines } = args;
  const now = new Date().toISOString();

  const byKey = new Map<string, string>();

  for (const line of lines) {
    if (String(line.product_id || "").trim()) continue;

    const displayName = String(line.name || "").trim();
    if (!displayName) continue;

    const itemKey =
      invoiceItemToKey(String(line.item_key || "").trim() || displayName);
    if (!itemKey) continue;

    byKey.set(itemKey, displayName);
  }

  if (byKey.size === 0) return;

  const rows = [...byKey.entries()].map(([item_key, display_name]) => ({
    org_id: orgId,
    item_key,
    display_name,
    last_used_at: now,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("org_manual_items")
    .upsert(rows, { onConflict: "org_id,item_key" });

  if (error) {
    console.warn("upsertOrgManualItemsFromLines failed:", error.message);
  }
}

export async function searchOrgManualItems(args: {
  supabase: SupabaseClient;
  orgId: string;
  query?: string;
  limit?: number;
}): Promise<OrgManualItem[]> {
  const { supabase, orgId } = args;
  const limit = Math.min(50, Math.max(1, Math.floor(args.limit ?? 20)));
  const q = String(args.query || "").trim();

  let query = supabase
    .from("org_manual_items")
    .select("item_key, display_name, last_used_at")
    .eq("org_id", orgId)
    .order("last_used_at", { ascending: false })
    .limit(limit);

  if (q) {
    query = query.ilike("display_name", `%${q.replace(/[%_]/g, "")}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("searchOrgManualItems failed:", error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    item_key: String(row.item_key || ""),
    display_name: String(row.display_name || ""),
    last_used_at: row.last_used_at ?? null,
  }));
}
