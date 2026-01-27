// app/api/delivery-notes/pdf/[id]/route.ts
// FULL REPLACE — SJ Half Letter Landscape, repeat header each page, chunked rows, signatures only last page
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";

type OrgProfile = {
  id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
};

function safeText(v: any) {
  return String(v ?? "").trim();
}

function fmtDateISO(s: any) {
  if (!s) return "-";
  const str = String(s);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return str;
}

// ====== TUNING LIMIT (silakan ubah kalau mau) ======
const LIMIT_FIRST_PAGE = 4;      // page 1 ada info card
const LIMIT_MIDDLE_PAGE = 7;    // page 2..n-1
const LIMIT_LAST_PAGE = 4;       // last page ada tanda tangan
// ====================================================

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();

  const url = new URL(req.url);
  const isDownload = url.searchParams.get("download") === "1";

  const supabaseUser = createServerClient(
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

  const { data: userRes } = await supabaseUser.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: gate, error: gateErr } = await supabaseUser
    .from("delivery_notes")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (gateErr) return NextResponse.json({ error: gateErr.message }, { status: 403 });
  if (!gate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: dn, error: dnErr } = await admin
    .from("delivery_notes")
    .select(
      `
      id,
      org_id,
      invoice_id,
      sj_number,
      sj_date,
      shipping_address,
      driver_name,
      note,
      invoice:invoices (
        customer_name,
        customer_phone,
        customer_address
      )
    `
    )
    .eq("id", id)
    .single();

  if (dnErr || !dn) {
    return NextResponse.json(
      { error: dnErr?.message || "Delivery note not found" },
      { status: 400 }
    );
  }

  const { data: items, error: itemsErr } = await admin
    .from("delivery_note_items")
    .select("name, qty, sort_order")
    .eq("delivery_note_id", id)
    .order("sort_order", { ascending: true });

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 });

  let org: OrgProfile | null = null;
  if (dn.org_id) {
    const { data: orgRow } = await admin
      .from("organizations")
      .select("id, name, address, phone, email, logo_url")
      .eq("id", dn.org_id)
      .maybeSingle();
    org = (orgRow as any) || null;
  }

  const logoSrc = safeText(org?.logo_url);

  const doc = React.createElement(SuratJalanDoc as any, {
    dn,
    items: items || [],
    org,
    logoSrc,
  }) as unknown as React.ReactElement;

  const buffer = await pdf(doc as any).toBuffer();

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${safeText(
        dn.sj_number || "surat-jalan"
      )}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

function SuratJalanDoc(props: { dn: any; items: any[]; org: OrgProfile | null; logoSrc: string }) {
  const { dn, items, org, logoSrc } = props;

  const orgName = safeText(org?.name) || "ORGANISASI";
  const orgAddr = safeText(org?.address);
  const orgPhone = safeText(org?.phone);
  const orgEmail = safeText(org?.email);

  const sjNo = safeText(dn?.sj_number) || "-";
  const sjDate = fmtDateISO(dn?.sj_date);

  const inv = dn?.invoice || {};
  const customerName = safeText(inv?.customer_name) || "-";
  const customerPhone = safeText(inv?.customer_phone) || "-";
  const customerAddr = safeText(dn?.shipping_address || inv?.customer_address) || "-";
  const driver = safeText(dn?.driver_name) || "-";

  const list = (items || []).map((x) => ({
    name: safeText(x?.name) || "-",
    qty: x?.qty ?? "",
  }));

  // ====== build pages by limits ======
  // page 1
  const pages: { rows: any[]; kind: "first" | "middle" | "last" }[] = [];
  let cursor = 0;

  const firstRows = list.slice(cursor, cursor + LIMIT_FIRST_PAGE);
  cursor += firstRows.length;
  pages.push({ rows: firstRows, kind: "first" });

  // remaining
  const remaining = list.slice(cursor);

  if (remaining.length === 0) {
    // if only 1 page, treat as last too
    pages[0].kind = "last";
  } else {
    // make middle pages (leave last chunk)
    // We will take chunks of LIMIT_MIDDLE_PAGE until remaining <= LIMIT_LAST_PAGE
    let remCursor = 0;
    while (remaining.length - remCursor > LIMIT_LAST_PAGE) {
      const chunk = remaining.slice(remCursor, remCursor + LIMIT_MIDDLE_PAGE);
      remCursor += chunk.length;
      pages.push({ rows: chunk, kind: "middle" });
    }
    const lastChunk = remaining.slice(remCursor);
    pages.push({ rows: lastChunk, kind: "last" });
  }
  // ===================================

  return React.createElement(
    Document,
    null,
    ...pages.map((p, idx) =>
      React.createElement(
        Page,
        { key: idx, size: [612, 396], style: styles.page },

        React.createElement(View, { style: styles.topBar }),

        React.createElement(
          View,
          { style: styles.headerCard },
          React.createElement(
            View,
            { style: styles.headerLeft },
            logoSrc
              ? React.createElement(Image, { src: logoSrc, style: styles.logo })
              : React.createElement(View, { style: styles.logoPh }),
            React.createElement(
              View,
              null,
              React.createElement(Text, { style: styles.orgTitle }, orgName),
              orgAddr ? React.createElement(Text, { style: styles.muted }, orgAddr) : null,
              orgPhone || orgEmail
                ? React.createElement(
                    Text,
                    { style: styles.muted },
                    `Tel: ${orgPhone || "-"}  •  Email: ${orgEmail || "-"}`
                  )
                : null
            )
          ),
          React.createElement(
            View,
            { style: styles.headerRight },
            React.createElement(Text, { style: styles.typeBlue }, "SURAT JALAN"),
            React.createElement(Text, { style: styles.docNo }, sjNo),
            React.createElement(Text, { style: styles.muted }, `Tanggal: ${sjDate}`),
            React.createElement(Text, { style: styles.pageNo }, `Halaman ${idx + 1}/${pages.length}`)
          )
        ),

        // info card only on first page
        p.kind === "first"
          ? React.createElement(
              View,
              { style: [styles.card, { marginTop: 10 }] },
              React.createElement(Text, { style: styles.cardTitle }, "Informasi Pengiriman"),
              React.createElement(Text, { style: styles.bold }, customerAddr),
              React.createElement(Text, { style: styles.muted }, `Penerima: ${customerName}`),
              React.createElement(Text, { style: styles.muted }, `Telp: ${customerPhone}`),
              React.createElement(Text, { style: styles.muted }, `Driver/Kurir: ${driver}`)
            )
          : null,

        // table card always
        React.createElement(
          View,
          { style: [styles.tableCard, { marginTop: p.kind === "first" ? 10 : 12 }] },
          React.createElement(
            View,
            { style: styles.trHead },
            React.createElement(Text, { style: [styles.th, { flex: 5 }] }, "Barang"),
            React.createElement(Text, { style: [styles.th, { flex: 1, textAlign: "right" }] }, "Qty")
          ),
          ...p.rows.map((it: any, rIdx: number) =>
            React.createElement(
              View,
              { style: styles.tr, key: `${idx}-${rIdx}` },
              React.createElement(Text, { style: [styles.td, { flex: 5 }] }, it.name),
              React.createElement(Text, { style: [styles.td, { flex: 1, textAlign: "right" }] }, String(it.qty))
            )
          )
        ),

        // footer left always
        React.createElement(
          View,
          { style: styles.footerRow },
        
          p.kind === "last"
            ? React.createElement(
                View,
                { style: styles.signRow },
                SignBox("Pengirim"),
                SignBox("Driver/Kurir"),
                SignBox("Penerima")
              )
            : React.createElement(View, null)
        )
      )
    )
  );
}

function SignBox(title: string) {
  return React.createElement(
    View,
    { style: styles.signBox },
    React.createElement(Text, { style: styles.signTitle }, title),
    React.createElement(View, { style: styles.signLine }),
    React.createElement(Text, { style: styles.signHint }, "(Nama jelas)")
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    fontSize: 10.5,
    color: "#111",
    flexDirection: "column",
  },

  topBar: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "#2563eb",
    marginBottom: 10,
  },

  headerCard: {
    borderWidth: 1,
    borderColor: "#eaeaea",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  headerLeft: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  headerRight: { alignItems: "flex-end" },

  logo: { width: 44, height: 44, borderRadius: 10 },
  logoPh: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: "#ddd" },

  orgTitle: { fontSize: 12.5, fontWeight: 800 },
  docNo: { fontSize: 12.5, fontWeight: 900 },
  typeBlue: { color: "#2563eb", fontWeight: 900 },
  pageNo: { color: "#94a3b8", fontSize: 9.5, marginTop: 4 },

  muted: { color: "#6b7280" },
  bold: { fontWeight: 800 },

  card: {
    borderWidth: 1,
    borderColor: "#eaeaea",
    borderRadius: 14,
    padding: 12,
  },

  cardTitle: { color: "#2563eb", fontWeight: 900, marginBottom: 6 },

  tableCard: {
    borderWidth: 1,
    borderColor: "#eaeaea",
    borderRadius: 14,
    overflow: "hidden",
  },

  trHead: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeaea",
  },

  tr: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },

  th: { fontWeight: 900, color: "#111" },
  td: { color: "#111" },

  footerRow: {
    marginTop: "auto",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 10,
  },

  footerMuted: { color: "#94a3b8", fontSize: 9.5 },

  signRow: {
    flexDirection: "row",
    gap: 10,
  },

  signBox: {
    width: 160,
    borderWidth: 1,
    borderColor: "#eaeaea",
    borderRadius: 14,
    padding: 10,
  },

  signTitle: { color: "#2563eb", fontWeight: 900, fontSize: 10.5 },
  signLine: { height: 1, backgroundColor: "#cbd5e1", marginTop: 22, marginBottom: 6 },
  signHint: { color: "#94a3b8", fontSize: 9.5 },
});