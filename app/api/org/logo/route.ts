export const runtime = "nodejs";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  // 1) Auth user (pakai cookie session)
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

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (userErr || !user) {
    return Response.json({ error: "Not logged in" }, { status: 401 });
  }

  // 2) Cari org_id user via memberships
  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memErr || !mem?.org_id) {
    return Response.json({ error: "No organization found for this user" }, { status: 400 });
  }

  // 3) Terima file dari form-data
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }

  // basic validation
  const mime = file.type || "";
  if (!mime.startsWith("image/")) {
    return Response.json({ error: "File harus gambar" }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return Response.json({ error: "Max 2MB" }, { status: 400 });
  }

  // 4) Supabase Admin (service role) -> upload ke bucket
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";

  const path = `${mem.org_id}/logo.${safeExt}`; // 1 org 1 logo (overwrite)
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const { error: upErr } = await admin.storage
    .from("org-logos")
    .upload(path, bytes, {
      upsert: true,
      contentType: mime || `image/${safeExt}`,
      cacheControl: "3600",
    });

  if (upErr) {
    return Response.json({ error: upErr.message }, { status: 400 });
  }

  // 5) Ambil public url (bucket kamu public)
  const { data: pub } = admin.storage.from("org-logos").getPublicUrl(path);
  const logoUrl = pub.publicUrl;

  // 6) Simpan ke table organizations (PASTIKAN kolomnya ada)
  // bikin kolom: logo_url text (kalau belum)
  const { error: orgErr } = await supabase
    .from("organizations")
    .update({ logo_url: logoUrl })
    .eq("id", mem.org_id);

  if (orgErr) {
    return Response.json({ error: orgErr.message }, { status: 400 });
  }

  return Response.json({ ok: true, logo_url: logoUrl, path });
}
