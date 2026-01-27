// app/api/delivery-notes/pdf-dotmatrix/[id]/route.ts
// FULL REPLACE (NO JSX, PURE React.createElement) — aman buat .ts (bukan .tsx)
// Surat Jalan DOT MATRIX Half Letter Landscape + limit items per halaman + header repeat + 3 signature on last page

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, pdf } from "@react-pdf/renderer";

type OrgProfile = {
  id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
};

type ItemRow = { name: string; qty: any; sort_order?: number | null; unit?: string | null };

// ====== LIMIT PER HALAMAN (ubah sesukamu) ======
const ITEMS_FIRST_PAGE = 4;
const ITEMS_MIDDLE_PAGES = 7;
const ITEMS_LAST_PAGE = 7;

// Half Letter LANDSCAPE (8.5 x 5.5 inch) -> points
const HALF_LETTER_LANDSCAPE: [number, number] = [612, 396];

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // cookies() bisa ke-typing Promise di beberapa versi Next
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  const url = new URL(req.url);
  const isDownload = url.searchParams.get("download") === "1";

  // 1) user client (RLS gate)
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  const { data: userRes } = await supabaseUser.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: dnGate, error: dnGateErr } = await supabaseUser
    .from("delivery_notes")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (dnGateErr) return NextResponse.json({ error: dnGateErr.message }, { status: 403 });
  if (!dnGate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 2) admin client (service role) buat fetch full data
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // IMPORTANT: jangan select invoice.shipping_address (sering gak ada kolomnya)
  const { data: dn, error: dnErr } = await admin
    .from("delivery_notes")
    .select(
      `
      *,
      invoice:invoices (
        invoice_number,
        customer_name,
        customer_phone,
        customer_address
      )
    `
    )
    .eq("id", id)
    .single();

  if (dnErr || !dn) return NextResponse.json({ error: dnErr?.message || "Delivery note not found" }, { status: 400 });

  const { data: items, error: itemsErr } = await admin
    .from("delivery_note_items")
    .select("name, qty, sort_order, unit")
    .eq("delivery_note_id", id)
    .order("sort_order", { ascending: true });

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 });

  // org profile
  let org: OrgProfile | null = null;
  if (dn.org_id) {
    const { data: orgRow } = await admin
      .from("organizations")
      .select("id, name, address, phone, email, logo_url")
      .eq("id", dn.org_id)
      .maybeSingle();
    org = (orgRow as any) || null;
  }

  const logoSrc = String(org?.logo_url || "").trim();

  // render PDF (typing @react-pdf suka rewel => cast any)
  const element = React.createElement(SuratJalanDotMatrixPDF as any, {
    dn,
    items: (items || []) as ItemRow[],
    org,
    logoSrc,
    limits: { first: ITEMS_FIRST_PAGE, middle: ITEMS_MIDDLE_PAGES, last: ITEMS_LAST_PAGE },
  }) as any;

  const buffer = await pdf(element).toBuffer();

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${String(
        dn.sj_number || "surat-jalan"
      )}-dotmatrix.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

// =========================
// PDF COMPONENT (NO JSX)
// =========================
function SuratJalanDotMatrixPDF(props: {
  dn: any;
  items: ItemRow[];
  org: OrgProfile | null;
  logoSrc: string;
  limits: { first: number; middle: number; last: number };
}) {
  const dn = props.dn;
  const items = props.items || [];
  const org = props.org;
  const logoSrc = props.logoSrc;
  const limits = props.limits;

  const orgName = safe(org?.name) || "INVOICEKU";
  const orgAddr = safe(org?.address);
  const orgPhone = safe(org?.phone);

  const sjNo = safe(dn?.sj_number) || "-";
  const sjDate = fmtDateIndo(dn?.sj_date || dn?.created_at);

  const inv = dn?.invoice || {};
  const receiverName = safe(inv?.customer_name) || safe(dn?.customer_name) || "-";
  const receiverPhone = safe(inv?.customer_phone) || safe(dn?.customer_phone) || "-";
  const shipAddr = safe(dn?.shipping_address) || safe(inv?.customer_address) || "-";

  const driverName = safe(dn?.driver_name) || safe(dn?.driver) || "-";
  const invNo = safe(inv?.invoice_number) || safe(dn?.invoice_number) || "-";

  const paged: ItemRow[][] = paginateItems(items, limits.first, limits.middle, limits.last);
  const totalPages = paged.length;

  const pages = paged.map((chunk: ItemRow[], pageIndex: number) => {
    const pageNo = pageIndex + 1;
    const isFirst = pageIndex === 0;
    const isLast = pageIndex === totalPages - 1;

    const headerEl = HeaderDotMatrix({
      logoSrc,
      orgName,
      orgAddr,
      orgPhone,
      sjNo,
      sjDate,
      pageNo,
      totalPages,
    });

    const infoEl = isFirst
      ? React.createElement(
          View,
          { style: s.infoBlock },
          React.createElement(Text, { style: s.infoTitle }, "Info Penerima"),
          React.createElement(Text, { style: s.infoLine }, receiverName),
          React.createElement(Text, { style: s.infoLine }, shipAddr),
          React.createElement(Text, { style: s.infoLine }, `Telp : ${receiverPhone}`),
          React.createElement(Text, { style: s.infoLine }, "No. Kendaraan : -"),
          React.createElement(Text, { style: s.infoLine }, `No. Invoice : ${invNo}`),
          React.createElement(Text, { style: s.infoLine }, `Driver : ${driverName}`)
        )
      : null;

    const tableHead = React.createElement(
      View,
      { style: s.trHead },
      React.createElement(Text, { style: [s.th, s.cNo] }, "No"),
      React.createElement(Text, { style: [s.th, s.cName] }, "Nama Produk"),
      React.createElement(Text, { style: [s.th, s.cDesc] }, "Deskripsi Produk"),
      React.createElement(Text, { style: [s.th, s.cQty] }, "Kuantitas"),
      React.createElement(Text, { style: [s.th, s.cUnit] }, "Unit")
    );

    const baseNo = countPrev(paged, pageIndex);
    const rows = chunk.map((it: ItemRow, idx: number) => {
      const no = baseNo + idx + 1;
      return React.createElement(
        View,
        { key: `${pageNo}-${idx}`, style: s.tr },
        React.createElement(Text, { style: [s.td, s.cNo] }, String(no)),
        React.createElement(Text, { style: [s.td, s.cName] }, safe(it?.name) || "-"),
        React.createElement(Text, { style: [s.td, s.cDesc] }, "-"),
        React.createElement(Text, { style: [s.td, s.cQty] }, fmtQty(it?.qty)),
        React.createElement(Text, { style: [s.td, s.cUnit] }, safe(it?.unit) || "-")
      );
    });

    const tableEl = React.createElement(View, { style: s.table }, tableHead, ...rows);

    const signEl = isLast
      ? React.createElement(
          View,
          { style: s.signWrap },
          SignCol("Penerima,"),
          SignCol("Driver,"),
          SignCol("Pengirim,")
        )
      : null;

    const footerPage = React.createElement(Text, { style: s.footerPage }, `${pageNo}/${totalPages}`);

    return React.createElement(
      Page,
      { key: `p-${pageNo}`, size: HALF_LETTER_LANDSCAPE as any, style: s.page },
      headerEl,
      infoEl,
      tableEl,
      signEl,
      footerPage
    );
  });

  return React.createElement(Document, null, ...pages);
}

function HeaderDotMatrix(args: {
  logoSrc: string;
  orgName: string;
  orgAddr: string;
  orgPhone: string;
  sjNo: string;
  sjDate: string;
  pageNo: number;
  totalPages: number;
}) {
  const { logoSrc, orgName, orgAddr, orgPhone, sjNo, sjDate, pageNo, totalPages } = args;

  return React.createElement(
    View,
    { style: s.header },
    React.createElement(
      View,
      { style: s.headerLeft },
      logoSrc ? React.createElement(Image, { src: logoSrc, style: s.logo }) : React.createElement(View, { style: s.logoPh }),
      React.createElement(
        View,
        null,
        React.createElement(Text, { style: s.orgName }, orgName.toLowerCase()),
        orgAddr ? React.createElement(Text, { style: s.orgSub }, orgAddr) : null,
        orgPhone ? React.createElement(Text, { style: s.orgSub }, `Telp ${orgPhone}`) : null
      )
    ),
    React.createElement(
      View,
      { style: s.headerCenter },
      React.createElement(Text, { style: s.docTitle }, "Surat Jalan"),
      React.createElement(Text, { style: s.docSub }, `No. Surat Jalan: ${sjNo}`)
    ),
    React.createElement(
      View,
      { style: s.headerRight },
      React.createElement(Text, { style: s.docSub }, `Tanggal : ${sjDate}`),
      React.createElement(Text, { style: s.docSub }, `Halaman ${pageNo}/${totalPages}`)
    )
  );
}

function SignCol(title: string) {
  return React.createElement(
    View,
    { style: s.signCol },
    React.createElement(Text, { style: s.signTitle }, title),
    React.createElement(Text, { style: s.signSpace }, " "),
    React.createElement(Text, { style: s.signHint }, "(             )")
  );
}

// =========================
// Pagination helpers
// =========================
function paginateItems(all: ItemRow[], first: number, middle: number, last: number): ItemRow[][] {
  const items = Array.isArray(all) ? all : [];
  const n = items.length;

  if (n <= first) return [items];

  const restAfterFirst = n - first;
  if (restAfterFirst <= last) {
    return [items.slice(0, first), items.slice(first)];
  }

  const pages: ItemRow[][] = [];
  pages.push(items.slice(0, first));

  const remainForMiddle = n - first - last;
  let offset = first;

  while (offset < first + remainForMiddle) {
    pages.push(items.slice(offset, offset + middle));
    offset += middle;
  }

  pages.push(items.slice(n - last));
  return pages;
}

function countPrev(pages: ItemRow[][], pageIndex: number): number {
  let sum = 0;
  for (let i = 0; i < pageIndex; i++) sum += pages[i]?.length || 0;
  return sum;
}

// =========================
// Formatters
// =========================
function safe(v: any): string {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function fmtQty(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return safe(v) || "-";
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

function fmtDateIndo(input: any): string {
  if (!input) return "-";
  const d = new Date(String(input));
  if (Number.isNaN(d.getTime())) return String(input);
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = months[d.getMonth()];
  const yy = d.getFullYear();
  return `${dd} ${mm} ${yy}`;
}

// =========================
// Styles (dotmatrix look) — fixed width column (no flex)
// =========================
const s = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 14,
    fontSize: 10,
    color: "#111",
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#111",
    marginBottom: 8,
  },

  headerLeft: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  headerCenter: { alignItems: "center", justifyContent: "center", flex: 1 },
  headerRight: { alignItems: "flex-end", justifyContent: "flex-start", width: 170 },

  logo: { width: 28, height: 28, borderRadius: 999 },
  logoPh: { width: 28, height: 28, borderWidth: 1, borderColor: "#111", borderRadius: 999 },

  orgName: { fontSize: 13, fontWeight: 700 },
  orgSub: { fontSize: 9.5 },

  docTitle: { fontSize: 12, fontWeight: 700 },
  docSub: { fontSize: 9.5 },

  infoBlock: { marginTop: 2, marginBottom: 10 },
  infoTitle: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  infoLine: { fontSize: 9.5 },

  table: { marginTop: 2 },
  trHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111",
    paddingBottom: 4,
    marginBottom: 2,
  },
  tr: { flexDirection: "row", paddingVertical: 2 },

  th: { fontSize: 9.5, fontWeight: 700 },
  td: { fontSize: 9.5 },

  // Fixed column widths
  cNo: { width: 26 },
  cName: { width: 170, paddingRight: 6 },
  cDesc: { width: 230, paddingRight: 6 },
  cQty: { width: 70, textAlign: "right", paddingRight: 6 },
  cUnit: { width: 40 },

  signWrap: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  signCol: { width: 160, alignItems: "center" },
  signTitle: { fontSize: 10, fontWeight: 700 },
  signSpace: { height: 34 },
  signHint: { fontSize: 10 },

  footerPage: {
    position: "absolute",
    right: 12,
    bottom: 10,
    fontSize: 9.5,
  },
});