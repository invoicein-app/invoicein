export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { requireApiContext } from "@/lib/api-context";

export async function POST(req: Request) {
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;

  const { supabase, orgId } = auth.ctx;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }

  const mime = file.type || "";
  if (!mime.startsWith("image/")) {
    return Response.json({ error: "File harus gambar" }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return Response.json({ error: "Max 2MB" }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";

  const path = `${orgId}/logo.${safeExt}`;
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

  const { data: pub } = admin.storage.from("org-logos").getPublicUrl(path);
  const logoUrl = pub.publicUrl;

  const { error: orgErr } = await supabase
    .from("organizations")
    .update({ logo_url: logoUrl })
    .eq("id", orgId);

  if (orgErr) {
    return Response.json({ error: orgErr.message }, { status: 400 });
  }

  return Response.json({ ok: true, logo_url: logoUrl, path });
}
