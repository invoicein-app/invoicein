// app/api/invoice/pdf-dotmatrix/[id]/route.ts
// (NEW FILE) Dot-matrix style PDF (Paper.id-ish, black & white) — does NOT replace your modern blue template
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

  // cookies() kadang ke-typing Promise di beberapa versi Next — handle dua-duanya.
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

  // NOTE: typing pdf() suka rewel, cast any saja biar tidak merah.
  const element = React.createElement(InvoiceDotMatrixPDF as any, {
    inv,
    items: items || [],
    org,
    logoSrc,
  }) as any;

  const buffer = await pdf(element).toBuffer();

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${String(
        inv.invoice_number || "invoice"
      )}-dotmatrix.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

/** =======================
 * Helpers
 * ======================= */

function safeText(v: any) {
  return String(v ?? "").trim();
}

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDateDM(input: any) {
  if (!input) return "-";
  const d = new Date(String(input));
  if (Number.isNaN(d.getTime())) return String(input);

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${dd}/${mm}/${yy}`;
}

// dotmatrix biasanya pakai angka 2 desimal di harga (contoh kamu)
function fmtMoney2(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMoney0(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

function calc(inv: any, items: any[]) {
  const subtotal = (items || []).reduce((a, it) => a + toNum(it.qty) * toNum(it.price), 0);

  // discount_type: none/percent/fixed/amount (kamu bisa sesuaikan)
  let disc = 0;
  if (inv.discount_type === "percent") disc = subtotal * (toNum(inv.discount_value) / 100);
  if (inv.discount_type === "fixed" || inv.discount_type === "amount") disc = toNum(inv.discount_value);
  const afterDisc = Math.max(0, subtotal - disc);

  let tax = 0;
  if (inv.tax_type === "percent") tax = afterDisc * (toNum(inv.tax_value) / 100);
  if (inv.tax_type === "amount") tax = toNum(inv.tax_value);

  const total = Math.max(0, afterDisc + tax);
  return { subtotal, disc, tax, total };
}

/**
 * Terbilang ID sederhana (untuk total integer)
 * - dotmatrix invoice umumnya pakai terbilang integer (rupiah)
 * - kalau total kamu ada .xx, kita bulatkan ke 0 (integer) biar aman
 */
function terbilangID(n: number) {
  const angka = Math.floor(Math.abs(n));

  const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];

  function bilang(x: number): string {
    if (x < 12) return satuan[x];
    if (x < 20) return `${bilang(x - 10)} Belas`;
    if (x < 100) return `${bilang(Math.floor(x / 10))} Puluh${x % 10 ? " " + bilang(x % 10) : ""}`;
    if (x < 200) return `Seratus${x - 100 ? " " + bilang(x - 100) : ""}`;
    if (x < 1000)
      return `${bilang(Math.floor(x / 100))} Ratus${x % 100 ? " " + bilang(x % 100) : ""}`;
    if (x < 2000) return `Seribu${x - 1000 ? " " + bilang(x - 1000) : ""}`;
    if (x < 1000000)
      return `${bilang(Math.floor(x / 1000))} Ribu${x % 1000 ? " " + bilang(x % 1000) : ""}`;
    if (x < 1000000000)
      return `${bilang(Math.floor(x / 1000000))} Juta${x % 1000000 ? " " + bilang(x % 1000000) : ""}`;
    if (x < 1000000000000)
      return `${bilang(Math.floor(x / 1000000000))} Miliar${x % 1000000000 ? " " + bilang(x % 1000000000) : ""}`;
    return `${bilang(Math.floor(x / 1000000000000))} Triliun${x % 1000000000000 ? " " + bilang(x % 1000000000000) : ""}`;
  }

  const words = bilang(angka).replace(/\s+/g, " ").trim();
  if (!words) return "Nol Rupiah";
  return `${words} Rupiah`;
}

/** =======================
 * PDF Component
 * ======================= */

// Pagination: supaya tidak “nabrak” footer dotmatrix
// Kamu bisa ubah angka ini belakangan.
const FIRST_PAGE_ROWS = 15;
const NEXT_PAGE_ROWS = 18;

function chunkRows(items: any[]) {
  const arr = items || [];
  const pages: any[][] = [];
  if (arr.length <= FIRST_PAGE_ROWS) return [arr];

  pages.push(arr.slice(0, FIRST_PAGE_ROWS));
  let i = FIRST_PAGE_ROWS;
  while (i < arr.length) {
    pages.push(arr.slice(i, i + NEXT_PAGE_ROWS));
    i += NEXT_PAGE_ROWS;
  }
  return pages;
}

function InvoiceDotMatrixPDF(props: { inv: any; items: any[]; org: OrgProfile | null; logoSrc: string }) {
  const { inv, items, org, logoSrc } = props;

  const t = calc(inv, items);
  const pages = chunkRows(items);

  const orgName = safeText(org?.name) || "PERUSAHAAN";
  const orgAddr = safeText(org?.address);
  const orgPhone = safeText(org?.phone);
  const orgEmail = safeText(org?.email);

  const bankName = safeText(org?.bank_name);
  const bankAcc = safeText(org?.bank_account);
  const bankAccName = safeText(org?.bank_account_name);

  const invNo = safeText(inv?.invoice_number) || "-";
  const invDate = fmtDateDM(inv?.invoice_date);

  // optional: kalau nanti kamu punya field nomor SJ di invoice, isi disini.
  const sjNo =
    safeText(inv?.delivery_note_number) ||
    safeText(inv?.sj_number) ||
    safeText(inv?.surat_jalan_number) ||
    "-";

  const custName = safeText(inv?.customer_name) || "-";
  const custPhone = safeText(inv?.customer_phone);
  const custAddr = safeText(inv?.customer_address);

  // signature
  const signName = (bankAccName || orgName || "").replace(/\s+/g, " ").trim();
  const signDate = fmtDateDM(inv?.invoice_date || new Date().toISOString());

  // terbilang pakai integer rupiah
  const terbilang = terbilangID(t.total);

  return React.createElement(
    Document,
    null,
    ...pages.map((pageItems, pageIdx) => {
      const isFirst = pageIdx === 0;
      const isLast = pageIdx === pages.length - 1;
      const pageLabel = `${pageIdx + 1}/${pages.length}`;

      return React.createElement(
        Page,
        { key: pageIdx, size: "A4", style: styles.page },

        // Header (ulang di setiap halaman, seperti dotmatrix beneran)
        React.createElement(
          View,
          { style: styles.headerRow },

          React.createElement(
            View,
            { style: styles.headerLeft },
            logoSrc
              ? React.createElement(Image, { src: logoSrc, style: styles.logo })
              : React.createElement(View, { style: styles.logoPh })
          ),

          React.createElement(
            View,
            { style: styles.headerCenter },
            React.createElement(Text, { style: styles.orgName }, orgName.toUpperCase()),
            orgAddr ? React.createElement(Text, { style: styles.orgMeta }, orgAddr) : null,
            React.createElement(
              Text,
              { style: styles.orgMeta },
              `${orgPhone ? `Telp : ${orgPhone}` : ""}${orgPhone && orgEmail ? "  •  " : ""}${orgEmail ? orgEmail : ""}`
            )
          ),

          React.createElement(
            View,
            { style: styles.headerRight },
            React.createElement(Text, { style: styles.title }, "INVOICE"),
            React.createElement(Text, { style: styles.pageInfo }, `Halaman ${pageLabel}`)
          )
        ),

        // Top info area
        React.createElement(
          View,
          { style: styles.topInfoRow },

          // Kepada box (muncul hanya halaman pertama)
          isFirst
            ? React.createElement(
                View,
                { style: styles.kepadaBox },
                React.createElement(Text, { style: styles.kepadaLabel }, "Kepada Yth,"),
                React.createElement(Text, { style: styles.kepadaName }, custName),
                custAddr ? React.createElement(Text, { style: styles.kepadaText }, custAddr) : null,
                custPhone ? React.createElement(Text, { style: styles.kepadaText }, `Phone : ${custPhone}`) : null
              )
            : React.createElement(View, { style: styles.kepadaBoxGhost }),

          // Invoice info box
          React.createElement(
            View,
            { style: styles.invInfoBox },
            RowKV("Invoice Number", invNo, true),
            RowKV("Tanggal", invDate),
            RowKV("No. Surat Jalan", sjNo)
          )
        ),

        // Table
        React.createElement(
          View,
          { style: styles.tableWrap },
          // head
          React.createElement(
            View,
            { style: styles.trHead },
            Cell("No.", styles.cNoH),
            Cell("Deskripsi", styles.cDescH),
            Cell("Kuantitas", styles.cQtyH),
            React.createElement(
              View,
              { style: [styles.cPriceGroupH, styles.cellH] },
              React.createElement(Text, { style: styles.thCenter }, "Harga (Rp)"),
              React.createElement(
                View,
                { style: styles.priceSubHead },
                React.createElement(Text, { style: styles.thCenterSmall }, "/ Unit"),
                React.createElement(Text, { style: styles.thCenterSmall }, "Jumlah")
              )
            )
          ),

          // rows
          ...pageItems.map((it: any, idx: number) => {
            const no = isFirst ? pageIdx * NEXT_PAGE_ROWS + idx + 1 : FIRST_PAGE_ROWS + (pageIdx - 1) * NEXT_PAGE_ROWS + idx + 1;
            const qty = toNum(it?.qty);
            const price = toNum(it?.price);
            const amount = qty * price;

            return React.createElement(
              View,
              { key: `${pageIdx}-${idx}`, style: styles.tr },
              Cell(String(no), styles.cNo),
              Cell(safeText(it?.name) || "-", styles.cDesc),
              Cell(qty ? String(qty) : "-", styles.cQty),
              Cell(price ? fmtMoney2(price) : "0.00", styles.cUnit),
              Cell(amount ? fmtMoney2(amount) : "0.00", styles.cAmt)
            );
          }),

          // filler space on last page (biar tabel “blok” kelihatan dotmatrix)
          isLast
            ? React.createElement(View, { style: styles.tableFiller })
            : null
        ),

        // Footer area only on LAST PAGE
        isLast
          ? React.createElement(
              View,
              { style: styles.bottomArea },

              // Terbilang + totals row
              React.createElement(
                View,
                { style: styles.bottomRow },

                React.createElement(
                  View,
                  { style: styles.terbilangBox },
                  React.createElement(Text, { style: styles.terbilangLabel }, "Terbilang :"),
                  React.createElement(Text, { style: styles.terbilangText }, terbilang)
                ),

                React.createElement(
                  View,
                  { style: styles.totalBox },
                  TotalRow("Subtotal", `Rp ${fmtMoney2(t.subtotal)}`),
                  t.disc ? TotalRow("Diskon", `Rp ${fmtMoney2(t.disc)}`) : TotalRow("Diskon", "Rp 0.00"),
                  t.tax ? TotalRow("Pajak", `Rp ${fmtMoney2(t.tax)}`) : TotalRow("Pajak", "Rp 0.00"),
                  React.createElement(View, { style: styles.totalDivider }),
                  TotalRowStrong("Jumlah Tertagih", `Rp ${fmtMoney2(t.total)}`)
                )
              ),

              // Payment + Signature
              React.createElement(
                View,
                { style: styles.paySignRow },

                React.createElement(
                  View,
                  { style: styles.payBox },
                  React.createElement(Text, { style: styles.payText }, "Pembayaran mohon ditransfer via rekening :"),
                  bankName ? React.createElement(Text, { style: styles.payText }, bankName) : null,
                  bankAcc ? React.createElement(Text, { style: styles.payText }, `NO. REKENING : ${bankAcc}`) : null,
                  bankAccName ? React.createElement(Text, { style: styles.payText }, `ATAS NAMA : ${bankAccName}`) : null
                ),

                React.createElement(
                  View,
                  { style: styles.signBox },
                  React.createElement(Text, { style: styles.signDate }, signDate),
                  React.createElement(Text, { style: styles.signRespect }, "Dengan Hormat"),
                  React.createElement(View, { style: styles.signSpace }),
                  React.createElement(Text, { style: styles.signLine },)
                )
              )
            )
          : null
      );
    })
  );
}

function RowKV(k: string, v: string, boldVal?: boolean) {
  return React.createElement(
    View,
    { style: styles.kvRow },
    React.createElement(Text, { style: styles.kvKey }, `${k} :`),
    React.createElement(Text, { style: boldVal ? styles.kvValBold : styles.kvVal }, v || "-")
  );
}

function fmtQty(v: any) {
  const n = Number(v || 0);
  // kalau integer tampil 23, kalau decimal tampil 20.3
  return Number.isInteger(n) ? String(n) : String(n);
}

function Cell(text: string, style: any) {
  return React.createElement(
    View,
    { style: style },
    React.createElement(Text, { style: styles.tdText }, text)
  );
}

function TotalRow(k: string, v: string) {
  return React.createElement(
    View,
    { style: styles.totalRow },
    React.createElement(Text, { style: styles.totalKey }, k),
    React.createElement(Text, { style: styles.totalVal }, v)
  );
}

function TotalRowStrong(k: string, v: string) {
  return React.createElement(
    View,
    { style: styles.totalRow },
    React.createElement(Text, { style: styles.totalKeyStrong }, k),
    React.createElement(Text, { style: styles.totalValStrong }, v)
  );
}

/** =======================
 * Styles (dotmatrix-ish)
 * ======================= */

const W_NO = 34;
const W_QTY = 90;
const W_UNIT = 110;  // kamu bisa adjust
const W_AMT  = 110;  // kamu bisa adjust
const BORDER = "#000";
const LIGHT = "#000";
const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 28,
    fontSize: 10,
    color: "#000",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  headerLeft: { width: 70 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerRight: { width: 120, alignItems: "flex-end" },

  logo: { width: 46, height: 46, borderRadius: 999 },
  logoPh: { width: 46, height: 46, borderRadius: 999, borderWidth: 1, borderColor: BORDER },

  orgName: { fontSize: 16, fontWeight: 900, textDecoration: "underline" },
  orgMeta: { fontSize: 10, marginTop: 2 },

  title: { fontSize: 16, fontWeight: 900, textDecoration: "underline" },
  pageInfo: { fontSize: 9, marginTop: 6 },

  topInfoRow: { flexDirection: "row", gap: 12, marginBottom: 10 },

  kepadaBox: {
    flex: 1.2,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 10,
    minHeight: 86,
    marginRight: 12,
  },
  kepadaBoxGhost: { flex: 1.2, minHeight: 86 },

  kepadaLabel: { fontSize: 10, marginBottom: 6 },
  kepadaName: { fontSize: 11, fontWeight: 900, marginBottom: 4 },
  kepadaText: { fontSize: 10, lineHeight: 1.25 },

  invInfoBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 10,
    minHeight: 86,
  },

  kvRow: { flexDirection: "row", marginBottom: 6 },
  kvKey: { width: 92, fontSize: 10 },
  kvVal: { flex: 1, fontSize: 10 },
  kvValBold: { flex: 1, fontSize: 10, fontWeight: 900 },

  // Table
  tableWrap: {
    borderWidth: 1,
    borderColor: BORDER,
    marginbottom: 10,
  },

  trHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },

  thCenter: { textAlign: "center", fontSize: 10, fontWeight: 900 },
  thCenterSmall: {textAlign: "center", fontSize: 9, fontWeight: 900 },

  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    Height: 40,
  },

  cellH: { paddingVertical: 6, paddingHorizontal: 6, justifyContent: "center" },
  tdText: { fontSize: 10 },

  // Columns widths (dotmatrix-ish)
  cNoH: {
  width: W_NO,
  borderRightWidth: 1,
  borderRightColor: BORDER,
  padding: 6,
  justifyContent: "center",
},
  cDescH: {
  width: 193,
  borderRightWidth: 1,
  borderRightColor: BORDER,
  padding: 6,
  justifyContent: "center",
},
  cQtyH: { width: 90, borderRightWidth: 1, borderRightColor: BORDER, padding: 6, justifyContent: "center"},

  cPriceGroupH: {
    flex: 1.6,
    padding: 6,
    justifyContent: "center",
  },
  priceSubHead: {
    flexDirection: "row",
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 2,
  },

  // body cols
  cNo: {
  width: W_NO,
  borderRightWidth: 1,
  borderRightColor: BORDER,
  padding: 6,
  justifyContent: "center",
},
  cDesc: {
  flex: 1, // deskripsi saja yang fleksibel biar ngisi sisa space
  borderRightWidth: 1,
  borderRightColor: BORDER,
  padding: 6,
  justifyContent: "center",
},
  cQty: {
  width: W_QTY,
  borderRightWidth: 1,
  borderRightColor: BORDER,
  padding: 6,
  justifyContent: "center",
  alignItems: "center",
},
  cUnit: {
  width: W_UNIT,
  borderRightWidth: 1,
  borderRightColor: BORDER,
  padding: 6,
  justifyContent: "center",
  alignItems: "flex-end",
},
  cAmt: {
  width: W_AMT,
  padding: 6,
  justifyContent: "center",
  alignItems: "flex-end",
},

  tableFiller: {
    height: 120, // ruang kosong seperti contoh dotmatrix, biar tidak aneh kalau item sedikit
  },

  // Bottom area
  bottomArea: { marginTop: 10 },

  bottomRow: { flexDirection: "row", gap: 10 },

  terbilangBox: {
    flex: 1.8,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 10,
    minHeight: 66,
    justifyContent: "center",
    marginRight: 10,
  },
  terbilangLabel: { fontSize: 10, marginBottom: 6 },
  terbilangText: { fontSize: 10, lineHeight: 1.25 },

  totalBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 10,
    minHeight: 66,
    justifyContent: "center",
  },

  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalKey: { fontSize: 10 },
  totalVal: { fontSize: 10, fontWeight: 700 },
  totalDivider: { height: 1, backgroundColor: BORDER, marginVertical: 6 },
  totalKeyStrong: { fontSize: 10, fontWeight: 900 },
  totalValStrong: { fontSize: 10, fontWeight: 900 },

  paySignRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, gap: 12 },

  payBox: { flex: 1.4,marginRight: 12 },
  payText: { fontSize: 10, marginBottom: 6 },

  signBox: { flex: 1, alignItems: "center" },
  signDate: { fontSize: 10, alignSelf: "flex-end" },
  signRespect: { fontSize: 10, fontWeight: 700, marginTop: 10 },
  signSpace: { height: 70, width: "100%" },
  signName: { fontSize: 11, fontWeight: 900 },
  signLine: {
  marginTop: 6,
  borderBottomWidth: 1,
  borderBottomColor: "#000",
  width: 160,
},
});