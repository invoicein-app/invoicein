import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import {
  getSubscription,
  requireCanWrite,
  type SubscriptionResult,
} from "@/lib/subscription";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ApiSupabase = SupabaseClient;

export type ApiContext = {
  supabase: ApiSupabase;
  user: User;
  orgId: string;
  actorRole: string;
  subscription: SubscriptionResult;
};

export type RequireApiContextOptions = {
  /** Block when org subscription is expired (mutations). */
  requireWrite?: boolean;
  /** Require org admin role (admin / owner / super_admin). */
  requireAdmin?: boolean;
};

export async function getSupabaseFromCookies(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export function isAdminRole(role: string): boolean {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "owner" || r === "super_admin";
}

export async function requireApiContext(
  options: RequireApiContextOptions = {}
): Promise<
  { ok: true; ctx: ApiContext } | { ok: false; response: NextResponse }
> {
  const supabase = await getSupabaseFromCookies();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const user = userRes.user;

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return {
      ok: false,
      response: NextResponse.json({ error: memErr.message }, { status: 400 }),
    };
  }
  if (!membership?.org_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Kamu belum punya organisasi aktif." },
        { status: 400 }
      ),
    };
  }

  const orgId = String(membership.org_id);
  const actorRole = String(membership.role || "staff");

  if (options.requireAdmin && !isAdminRole(actorRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden (admin only)" }, { status: 403 }),
    };
  }

  const subscription = await getSubscription(supabase, orgId);

  if (options.requireWrite) {
    const block = await requireCanWrite(supabase, orgId);
    if (block) {
      return { ok: false, response: block };
    }
  }

  return {
    ok: true,
    ctx: { supabase, user, orgId, actorRole, subscription },
  };
}

/** Subscription gate for a specific org (e.g. resource loaded after auth). */
export async function requireWriteForOrg(
  supabase: ApiSupabase,
  orgId: string
): Promise<NextResponse | null> {
  return requireCanWrite(supabase, orgId);
}

/** @deprecated Prefer requireApiContext(). Kept for gradual migration. */
export async function getAuthAndOrg(supabase: ApiSupabase) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = userRes.user;
  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return { error: NextResponse.json({ error: memErr.message }, { status: 400 }) };
  }
  if (!membership?.org_id) {
    return {
      error: NextResponse.json(
        { error: "Kamu belum punya organisasi aktif." },
        { status: 400 }
      ),
    };
  }

  return {
    user,
    orgId: String(membership.org_id),
    actorRole: String(membership.role || "staff"),
  };
}

export function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function asText(v: unknown) {
  return String(v ?? "").trim();
}
