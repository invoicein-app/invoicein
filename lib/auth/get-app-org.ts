import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";

export type AppOrgResult =
  | { ok: true; userId: string; orgId: string; role: string }
  | { ok: false; reason: "unauthorized" | "no_org"; message?: string };

/** Satu query auth + membership per request (React cache dedupe). */
export const getAppOrg = cache(async (): Promise<AppOrgResult> => {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;

  if (!user) {
    return { ok: false, reason: "unauthorized" };
  }

  const { data: mem, error } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error || !mem?.org_id) {
    return {
      ok: false,
      reason: "no_org",
      message: error?.message || "Membership tidak ditemukan.",
    };
  }

  return {
    ok: true,
    userId: user.id,
    orgId: String(mem.org_id),
    role: String(mem.role || "staff"),
  };
});
