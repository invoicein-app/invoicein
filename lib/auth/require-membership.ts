////////////////////////////////////////////////////////////
// 1) BUAT HELPER: lib/auth/require-membership.ts
////////////////////////////////////////////////////////////

import { NextResponse } from "next/server";

type MembershipRow = {
  org_id: string;
  role: "admin" | "staff" | string;
  is_active?: boolean | null;
  username?: string | null;
};

export async function requireUser(supabaseUser: any) {
  const { data, error } = await supabaseUser.auth.getUser();
  if (error || !data?.user) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user: data.user, error: null };
}

export async function requireMembership(supabaseUser: any, userId: string, orgId?: string) {
  // kalau orgId tidak dikirim: ambil membership pertama user
  let q = supabaseUser
    .from("memberships")
    .select("org_id, role, is_active, username")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (orgId) q = q.eq("org_id", orgId);

  const { data, error } = await q.maybeSingle();
  if (error) {
    return { membership: null, error: NextResponse.json({ error: error.message }, { status: 403 }) };
  }
  if (!data?.org_id) {
    return { membership: null, error: NextResponse.json({ error: "Membership not found" }, { status: 403 }) };
  }

  // optional: pakai is_active kalau sudah kamu tambah
  if (data.is_active === false) {
    return { membership: null, error: NextResponse.json({ error: "Account disabled" }, { status: 403 }) };
  }

  return { membership: data as MembershipRow, error: null };
}

export function forbidIfStaff(m: MembershipRow, message = "Forbidden (staff)") {
  if (m.role === "staff") {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  return null;
}

export function requireAdmin(m: MembershipRow) {
  if (m.role !== "admin") {
    return NextResponse.json({ error: "Forbidden (admin only)" }, { status: 403 });
  }
  return null;
}
