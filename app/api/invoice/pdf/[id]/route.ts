// app/api/invoice/pdf/[id]/route.ts
// FULL REPLACE - PaperID-ish BLUE + Org Data + Signature + MANUAL PAGE BREAK (first/middle/last)
// - ITEMS_FIRST_PAGE / ITEMS_NEXT_PAGES / ITEMS_LAST_PAGE bisa kamu atur sendiri
// - Page 1: header + 2 cards + table
// - Middle: header + table
// - Last: header + table + (Catatan + Total + Signature)

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
  bank_name: string | null;
  bank_account: string | null;
  bank_account_name: string | null;
  invoice_footer: string | null;
  logo_url: string | null;
};

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // NOTE: di beberapa versi Next, cookies() ke-typing Promise.
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  const url = new URL(req.url);
  const isDownload = url.searchParams.get("download") === "1";

  // 1) User client (RLS gate)
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

  const { data: invGate, error: invGateErr } = await supabaseUser
    .from("invoices")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (invGateErr) return NextResponse.json({ error: invGateErr.message }, { status: 403 });
  if (!invGate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  
  // 2) Admin client (service role) buat baca invoice + items + org
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: inv, error: invErr } = await admin.from("invoices").select("*").eq("id", id).single();
  if (invErr || !inv) return NextResponse.json({ error: invErr?.message || "Invoice not found" }, { status: 400 });

  const { data: items, error: itemsErr } = await admin
    .from("invoice_items")
    .select("name, qty, price, sort_order")
    .eq("invoice_id", id)
    .order("sort_order", { ascending: true });
const { data: sjLatest } = await admin
  .from("delivery_notes")
  .select("sj_number")
  .eq("invoice_id", id)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

const sjNumber = String(sjLatest?.sj_number || "").trim();
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 });



  let org: OrgProfile | null = null;
  if (inv.org_id) {
    const { data: orgData } = await admin
      .from("organizations")
      .select("id,name,address,phone,email,bank_name,bank_account,bank_account_name,invoice_footer,logo_url")
      .eq("id", inv.org_id)
      .maybeSingle();

    org = (orgData as any) || null;
  }



  const logoSrc = String(org?.logo_url || "").trim();

  // IMPORTANT: pdf(...) typing suka rewel, jadi cast any biar gak merah.
  const element = React.createElement(InvoicePDF as any, {
    inv,
    items: items || [],
    org,
    logoSrc,
    sjNumber,
  }) as any;

  const buffer = await pdf(element).toBuffer();

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${String(inv.invoice_number || "invoice")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

function rupiah(n: number) {
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

function fmtLongDate(s: any) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function calc(inv: any, items: any[]) {
  const sub = (items || []).reduce((a, it) => a + Number(it.qty || 0) * Number(it.price || 0), 0);

  let disc = 0;
  if (inv.discount_type === "percent") disc = sub * (Number(inv.discount_value || 0) / 100);
  // kamu tadi pakai "amount" / "fixed" kadang beda: amanin dua-duanya
  if (inv.discount_type === "amount" || inv.discount_type === "fixed") disc = Number(inv.discount_value || 0);

  const afterDisc = Math.max(0, sub - disc);

  let tax = 0;
  if (inv.tax_type === "percent") tax = afterDisc * (Number(inv.tax_value || 0) / 100);
  if (inv.tax_type === "amount" || inv.tax_type === "fixed") tax = Number(inv.tax_value || 0);

  const total = Math.max(0, afterDisc + tax);
  return { sub, disc, tax, total };
}

function fmtDateIndo(input: any) {
  if (!input) return "-";
  const d = new Date(String(input));
  if (Number.isNaN(d.getTime())) return String(input);

  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = months[d.getMonth()];
  const yy = d.getFullYear();
  return `${dd} ${mm}, ${yy}`;
}

/**
 * Pagination 3-mode:
 * - Page 1 maksimal firstCount
 * - Middle pages maksimal nextCount
 * - Last page maksimal lastCount (dan isinya adalah sisa paling akhir)
 *
 * Catatan:
 * - Kalau items sedikit, bisa jadi cuma 1 page (first sekaligus last)
 */
function paginate3<T>(items: T[], firstCount: number, nextCount: number, lastCount: number) {
  const list = items || [];
  const n = list.length;

  // fallback supaya gak aneh
  const f = Math.max(1, Number(firstCount || 1));
  const m = Math.max(1, Number(nextCount || 1));
  const l = Math.max(1, Number(lastCount || 1));

  // 0 item -> tetap 1 page kosong
  if (n === 0) return { pages: [[] as T[]], meta: { firstCount: f, nextCount: m, lastCount: l } };

  // kalau muat di page 1, jadikan 1 page saja (first+last)
  if (n <= f) return { pages: [list], meta: { firstCount: f, nextCount: m, lastCount: l } };

  // ambil page 1
  const pages: T[][] = [];
  pages.push(list.slice(0, f));

  // sisa setelah page 1
  const rest = list.slice(f);

  // kalau sisa muat di last page -> langsung last
  if (rest.length <= l) {
    pages.push(rest);
    return { pages, meta: { firstCount: f, nextCount: m, lastCount: l } };
  }

  // kalau sisa banyak:
  // kita sisakan lastCount buat last page, sisanya dibagi jadi middle pages (nextCount)
  const middlePart = rest.slice(0, rest.length - l);
  const lastPart = rest.slice(rest.length - l);

  let idx = 0;
  while (idx < middlePart.length) {
    pages.push(middlePart.slice(idx, idx + m));
    idx += m;
  }

  pages.push(lastPart);
  return { pages, meta: { firstCount: f, nextCount: m, lastCount: l } };
}

function InvoicePDF(props: { inv: any; items: any[]; org: OrgProfile | null; logoSrc: string; sjNumber: string }) {
  const { inv, items, org, logoSrc, sjNumber } = props;

  // ✅ REQUEST kamu: 3 variable biar kamu yang atur
  const ITEMS_FIRST_PAGE = 10; // page 1 ada 2 cards, jadi lebih sempit
  const ITEMS_NEXT_PAGES = 18; // middle pages
  const ITEMS_LAST_PAGE = 12; // last page ada totals+signature, jadi lebih sempit

  const { pages: itemPages } = paginate3(items || [], ITEMS_FIRST_PAGE, ITEMS_NEXT_PAGES, ITEMS_LAST_PAGE);
  const totalPages = itemPages.length;

  const t = calc(inv, items || []);

  const orgName = org?.name || "INVOICEKU";
  const orgAddress = org?.address || "";
  const orgPhone = org?.phone || "";
  const orgEmail = org?.email || "";

  const bankName = org?.bank_name || "";
  const bankAcc = org?.bank_account || "";
  const bankAccName = org?.bank_account_name || "";

  const customerName = String(inv.customer_name || "-");
  const customerPhone = String(inv.customer_phone || "");
  const customerAddr = String(inv.customer_address || "");

  const invNo = String(inv.invoice_number || "-");
  const invDate = fmtDateIndo(inv.invoice_date);

  return React.createElement(
    Document,
    null,
    ...itemPages.map((pageItems, pageIndex) => {
      const isFirst = pageIndex === 0;
      const isLast = pageIndex === totalPages - 1;

      return React.createElement(
        Page,
        { key: pageIndex, size: "A4", style: styles.page },

        // Top blue bar
        React.createElement(View, { style: styles.topBar }),

        // Header
        React.createElement(
          View,
          { style: styles.header },
          React.createElement(
            View,
            { style: { flexDirection: "row", gap: 12, alignItems: "center", flex: 1 } },
            logoSrc
              ? React.createElement(Image, { src: logoSrc, style: styles.logo })
              : React.createElement(View, { style: styles.logoPlaceholder }),

            React.createElement(
              View,
              { style: { flex: 1 } },
              React.createElement(Text, { style: styles.orgName }, orgName),
              orgAddress ? React.createElement(Text, { style: styles.muted }, orgAddress) : null,
              orgPhone || orgEmail
                ? React.createElement(
                    Text,
                    { style: styles.muted },
                    `${orgPhone}${orgPhone && orgEmail ? " • " : ""}${orgEmail}`
                  )
                : null
            )
          ),

          React.createElement(
            View,
            { style: { alignItems: "flex-end" } },
            React.createElement(Text, { style: styles.invLabel }, "INVOICE"),
            React.createElement(Text, { style: styles.invNo }, invNo),
            React.createElement(Text, { style: styles.muted }, `Tanggal: ${invDate}`),
           React.createElement(Text, { style: styles.muted }, `NO SJ: ${sjNumber || "-"}`),
            React.createElement(Text, { style: styles.muted }, `Halaman ${pageIndex + 1}/${totalPages}`)
          )
        ),

        // ✅ 2 cards cuma di halaman 1
        isFirst
          ? React.createElement(
              View,
              { style: styles.twoCols },
              // Ditagihkan ke
              React.createElement(
                View,
                { style: styles.card },
                React.createElement(Text, { style: styles.cardTitleBlue }, "Ditagihkan ke"),
                React.createElement(Text, { style: styles.bold }, customerName),
                customerPhone ? React.createElement(Text, { style: styles.muted }, customerPhone) : null,
                customerAddr ? React.createElement(Text, { style: styles.muted }, customerAddr) : null
              ),

              // Informasi Pembayaran
              React.createElement(
                View,
                { style: styles.card },
                React.createElement(Text, { style: styles.cardTitleBlue }, "Informasi Pembayaran"),
                bankName
                  ? React.createElement(
                      View,
                      { style: styles.infoRow },
                      React.createElement(Text, { style: styles.infoKey }, "Bank"),
                      React.createElement(Text, { style: styles.infoVal }, bankName)
                    )
                  : null,
                bankAcc
                  ? React.createElement(
                      View,
                      { style: styles.infoRow },
                      React.createElement(Text, { style: styles.infoKey }, "No Rekening"),
                      React.createElement(Text, { style: styles.infoVal }, bankAcc)
                    )
                  : null,
                bankAccName
                  ? React.createElement(
                      View,
                      { style: styles.infoRow },
                      React.createElement(Text, { style: styles.infoKey }, "Atas Nama"),
                      React.createElement(Text, { style: styles.infoVal }, bankAccName)
                    )
                  : null,
                !bankName && !bankAcc && !bankAccName
                  ? React.createElement(Text, { style: styles.muted }, "Belum diisi di Pengaturan Organisasi.")
                  : null
              )
            )
          : null,

        // Items table (per page)
        React.createElement(
          View,
          { style: styles.tableWrap },
          React.createElement(
            View,
            { style: styles.trHead },
            React.createElement(Text, { style: [styles.th, { flex: 4 }] }, "Item"),
            React.createElement(Text, { style: [styles.th, { flex: 1, textAlign: "right" }] }, "Qty"),
            React.createElement(Text, { style: [styles.th, { flex: 2, textAlign: "right" }] }, "Harga"),
            React.createElement(Text, { style: [styles.th, { flex: 2, textAlign: "right" }] }, "Total")
          ),
          ...(pageItems || []).map((it: any, idx: number) => {
            const qty = Number(it.qty || 0);
            const price = Number(it.price || 0);
            return React.createElement(
              View,
              { style: styles.tr, key: `${pageIndex}-${idx}` },
              React.createElement(Text, { style: [styles.td, { flex: 4 }] }, String(it.name || "")),
              React.createElement(Text, { style: [styles.td, { flex: 1, textAlign: "right" }] }, String(qty)),
              React.createElement(Text, { style: [styles.td, { flex: 2, textAlign: "right" }] }, rupiah(price)),
              React.createElement(Text, { style: [styles.td, { flex: 2, textAlign: "right" }] }, rupiah(qty * price))
            );
          })
        ),

        // ✅ Hanya halaman terakhir yang ada Catatan + Total + Signature
        isLast
          ? React.createElement(
              View,
              null,

              React.createElement(
                View,
                { style: styles.bottomGrid },
                React.createElement(
                  View,
                  { style: styles.card },
                  React.createElement(Text, { style: styles.cardTitle }, "Catatan"),
                  React.createElement(Text, { style: styles.muted }, String(inv.note || "-"))
                ),

                React.createElement(
                  View,
                  { style: [styles.card, styles.totalCard] },
                  RowPDF("Subtotal", rupiah(t.sub)),
                  RowPDF("Diskon", rupiah(t.disc)),
                  RowPDF("Pajak", rupiah(t.tax)),
                  React.createElement(View, { style: styles.divider }),
                  RowPDF("Grand Total", rupiah(t.total), true, true)
                )
              ),

              React.createElement(
                View,
                { style: styles.signatureWrap },
                React.createElement(Text, { style: styles.signatureDate }, fmtLongDate(inv.invoice_date)),
                React.createElement(Text, { style: styles.signatureRespect }, "Dengan Hormat,"),
                React.createElement(View, { style: styles.signatureSpace })
              )
            )
          : null
      );
    })
  );
}

function RowPDF(k: string, v: string, strong?: boolean, blueStrong?: boolean) {
  return React.createElement(
    View,
    { style: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 } },
    React.createElement(Text, { style: styles.rowKey }, k),
    React.createElement(
      Text,
      { style: strong ? (blueStrong ? styles.rowValStrongBlue : styles.rowValStrong) : styles.rowVal },
      v
    )
  );
}

const BLUE = "#2563eb";
const BLUE_SOFT = "#eaf2ff";
const BORDER = "#e6e6e6";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 11, color: "#111", backgroundColor: "white" },

  topBar: { height: 6, backgroundColor: BLUE, borderRadius: 999, marginBottom: 14 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },

  logo: { width: 54, height: 54, borderRadius: 999 },
  logoPlaceholder: { width: 54, height: 54, borderRadius: 999, borderWidth: 1, borderColor: BORDER },

  orgName: { fontSize: 14, fontWeight: 800 },
  invLabel: { color: BLUE, fontWeight: 900, letterSpacing: 0.6 },
  invNo: { fontSize: 13, fontWeight: 900, marginTop: 2 },

  twoCols: { marginTop: 14, flexDirection: "row", gap: 12 },
  card: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12 },
  cardTitleBlue: { fontSize: 11, fontWeight: 900, color: BLUE, marginBottom: 6 },
  cardTitle: { fontSize: 11, fontWeight: 900, marginBottom: 6 },

  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  infoKey: { color: "#666" },
  infoVal: { fontWeight: 700 },

  tableWrap: { marginTop: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 12, overflow: "hidden" },
  trHead: { flexDirection: "row", backgroundColor: BLUE_SOFT, padding: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  tr: { flexDirection: "row", padding: 10, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  th: { fontWeight: 900, color: "#1f2a44" },
  td: {},

  bottomGrid: { marginTop: 12, flexDirection: "row", gap: 12, alignItems: "stretch" },
  totalCard: { backgroundColor: "#f6faff", borderColor: "#cfe1ff" },

  divider: { height: 1, backgroundColor: "#cfe1ff", marginVertical: 6 },

  rowKey: { color: "#334155", fontWeight: 700 },
  rowVal: { color: "#111" },
  rowValStrong: { color: "#111", fontWeight: 900 },
  rowValStrongBlue: { color: BLUE, fontWeight: 900 },

  signatureWrap: {
    marginTop: 36,
    alignSelf: "flex-end",
    width: 260,
    paddingRight: 24,
    paddingBottom: 10,
  },

  signatureDate: {
    fontSize: 10,
    color: "#111",
    marginBottom: 6,
    textAlign: "right",
  },

  signatureRespect: {
    fontSize: 10,
    color: "#111",
    marginBottom: 26,
    textAlign: "right",
  },

  signatureSpace: {
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: "#111",
    width: 170,
    marginLeft: "auto",
    marginBottom: 6,
  },

  muted: { color: "#666" },
  bold: { fontWeight: 800 },
});