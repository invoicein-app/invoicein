export const runtime = "nodejs";

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSubscription, getTrialDays } from "@/lib/subscription";

export default async function SubscriptionBanner() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
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

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;

  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!mem?.org_id) return null;

  const sub = await getSubscription(supabase, mem.org_id);

  if (!sub.periodEndAt && !sub.expired) {
    return (
      <div
        style={{
          background: "#fff7ed",
          borderBottom: "1px solid #fed7aa",
          color: "#9a3412",
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        Data langganan belum lengkap.{" "}
        <Link href="/settings/subscription" style={{ color: "#c2410c", textDecoration: "underline" }}>
          Muat ulang setelah login
        </Link>{" "}
        atau hubungi admin.
      </div>
    );
  }

  if (!sub.expired) {
    const end = sub.periodEndAt ? new Date(sub.periodEndAt) : null;
    const daysLeft =
      end === null
        ? null
        : Math.max(0, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

    if (sub.status === "trial" && daysLeft !== null && daysLeft <= 7) {
      return (
        <div
          style={{
            background: "#fffbeb",
            borderBottom: "1px solid #fde68a",
            color: "#92400e",
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Masa trial berakhir dalam {daysLeft} hari
          {end
            ? ` (${end.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })})`
            : ""}
          .{" "}
          <Link href="/settings/subscription" style={{ color: "#b45309", textDecoration: "underline" }}>
            Perpanjang langganan
          </Link>
        </div>
      );
    }

    return null;
  }

  const endLabel = sub.periodEndAt
    ? new Date(sub.periodEndAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div
      style={{
        background: "#fef2f2",
        borderBottom: "1px solid #fecaca",
        color: "#991b1b",
        padding: "12px 16px",
        fontSize: 13,
        fontWeight: 600,
        textAlign: "center",
      }}
    >
      Langganan berakhir pada {endLabel}. Anda masih bisa melihat data, tetapi tidak bisa membuat atau
      mengubah transaksi. Trial default: {getTrialDays()} hari.{" "}
      <Link href="/settings/subscription" style={{ color: "#b91c1c", textDecoration: "underline" }}>
        Perpanjang sekarang
      </Link>
    </div>
  );
}
