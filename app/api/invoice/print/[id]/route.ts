// app/api/invoice/print/[id]/route.ts  (FULL REPLACE - DOT MATRIX 80 COL TEXT)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type OrgProfile = {
  id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_account_name: string | null;
};

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // cookies() bisa ke-typing Promise di beberapa versi next
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

  // RLS gate
  const { data: invGate, error: invGateErr } = await supabaseUser
    .from("invoices")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (invGateErr) return NextResponse.json({ error: invGateErr.message }, { status: 403 });
  if (!invGate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 2) admin (service role) fetch invoice, items, org
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
      .select("id,name,address,phone,email,bank_name,bank_account,bank_account_name")
      .eq("id", inv.org_id)
      .maybeSingle();
    org = (orgData as any) || null;
  }

  const text = buildDotMatrixInvoiceText({
    inv,
    items: items || [],
    org,
    // === SETTING DOT MATRIX ===
    cols: 80,           // 80 kolom (standar dot matrix)
    linesPerPage: 60,   // sesuaikan printer kamu (58-66 umum)
    firstPageLines: 34, // kapasitas item page 1 (karena header lebih tinggi)
    nextPageLines: 44,  // kapasitas item halaman tengah
    lastPageLines: 36,  // kapasitas item halaman terakhir (karena total+bank+ttd)
  });

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${String(
        inv.invoice_number || "invoice"
      )}.txt"`,
      "Cache-Control": "no-store",
    },
  });
}

/** =========================
 *  DOT MATRIX BUILDER
 *  ========================= */

function buildDotMatrixInvoiceText(opts: {
  inv: any;
  items: any[];
  org: OrgProfile | null;
  cols: number;
  linesPerPage: number;
  firstPageLines: number;
  nextPageLines: number;
  lastPageLines: number;
}) {
  const { inv, items, org, cols, linesPerPage, firstPageLines, nextPageLines, lastPageLines } = opts;

  const orgName = safe(org?.name) || "INVOICEKU";
  const orgAddr = safe(org?.address);
  const orgPhone = safe(org?.phone);
  const orgEmail = safe(org?.email);

  const bankName = safe(org?.bank_name);
  const bankAcc = safe(org?.bank_account);
  const bankAccName = safe(org?.bank_account_name);

  const invNo = safe(inv?.invoice_number) || "-";
  const invDate = fmtDate(inv?.invoice_date);
  const customerName = safe(inv?.customer_name) || "-";
  const customerPhone = safe(inv?.customer_phone);
  const customerAddr = safe(inv?.customer_address);

  const { sub, disc, tax, total } = calc(inv, items);

  // ==== Table column widths (80 cols) ====
  // Item(36) Qty(6) Price(14) Total(14) + separators/spaces
  const W_ITEM = 36;
  const W_QTY = 6;
  const W_PRICE = 14;
  const W_TOTAL = 14;

  const makeHeader = (page: number, totalPages: number, isFirst: boolean) => {
    const left = [
      orgName,
      orgAddr ? orgAddr : "",
      [orgPhone, orgEmail].filter(Boolean).join(" / "),
    ].filter(Boolean);

    const right = [
      "INVOICE",
      invNo,
      `Tanggal: ${invDate}`,
      `Hal: ${page}/${totalPages}`,
    ];

    const lines: string[] = [];
    lines.push(hr(cols));
    lines.push(twoCol(left[0] || "", right[0] || "", cols));
    lines.push(twoCol(left[1] || "", right[1] || "", cols));
    lines.push(twoCol(left[2] || "", right[2] || "", cols));
    lines.push(hr(cols));

    if (isFirst) {
      lines.push(`Ditagihkan ke : ${customerName}`);
      if (customerPhone) lines.push(`Telp         : ${customerPhone}`);
      if (customerAddr) lines.push(`Alamat       : ${customerAddr}`);
      lines.push(hr(cols));
    }

    // Table header
    lines.push(
      padRight("Item", W_ITEM) +
        " " +
        padLeft("Qty", W_QTY) +
        " " +
        padLeft("Harga", W_PRICE) +
        " " +
        padLeft("Total", W_TOTAL)
    );
    lines.push(repeat("-", cols));

    return lines;
  };

  const makeFooterLast = () => {
    const lines: string[] = [];
    lines.push(repeat("-", cols));

    // Totals right aligned
    lines.push(totalRow("Subtotal", sub, cols));
    lines.push(totalRow("Diskon", disc, cols));
    lines.push(totalRow("Pajak", tax, cols));
    lines.push(repeat("-", cols));
    lines.push(totalRow("GRAND TOTAL", total, cols, true));
    lines.push("");

    // Payment info (optional)
    if (bankName || bankAcc || bankAccName) {
      lines.push("Pembayaran:");
      if (bankName) lines.push(`- Bank      : ${bankName}`);
      if (bankAcc) lines.push(`- Rekening  : ${bankAcc}`);
      if (bankAccName) lines.push(`- Atas Nama : ${bankAccName}`);
      lines.push("");
    }

    // signature block (kanan bawah gaya dot matrix)
    const signDate = fmtLong(inv?.invoice_date);
    const signName = (bankAccName || orgName || "").trim();

    const sigWidth = 28;
    const indent = Math.max(0, cols - sigWidth);

    lines.push(sp(indent) + (signDate || ""));
    lines.push(sp(indent) + "Dengan Hormat,");
    lines.push(sp(indent) + "");
    lines.push(sp(indent) + "________________________");
    lines.push(sp(indent) + (signName || ""));
    lines.push("");
    lines.push(center("Dokumen dibuat otomatis.", cols));
    return lines;
  };

  // ==== Build item lines with wrapping ====
  const itemLines: string[] = [];
  for (const it of items || []) {
    const name = safe(it?.name) || "-";
    const qty = num(it?.qty);
    const price = num(it?.price);
    const lineTotal = qty * price;

    const nameWrapped = wrap(name, W_ITEM);
    nameWrapped.forEach((part, idx) => {
      if (idx === 0) {
        itemLines.push(
          padRight(part, W_ITEM) +
            " " +
            padLeft(fmtQty(qty), W_QTY) +
            " " +
            padLeft(rp(price), W_PRICE) +
            " " +
            padLeft(rp(lineTotal), W_TOTAL)
        );
      } else {
        // next wrap lines, only item name continued
        itemLines.push(padRight(part, W_ITEM) + " " + padLeft("", W_QTY) + " " + padLeft("", W_PRICE) + " " + padLeft("", W_TOTAL));
      }
    });
  }

  // ==== Paginate items by "row count" ====
  // Strategy: first page uses firstPageLines rows of itemLines,
  // middle pages uses nextPageLines,
  // last page uses lastPageLines so footer fits.
  // We decide last page chunk after counting how many pages needed.

  // If items short, just 1 page.
  // Otherwise: first chunk, then middle chunks, last chunk.
  const chunks: string[][] = [];
  if (itemLines.length <= firstPageLines) {
    chunks.push(itemLines);
  } else {
    const first = itemLines.slice(0, firstPageLines);
    let rest = itemLines.slice(firstPageLines);

    // Reserve last page capacity
    while (rest.length > lastPageLines) {
      // if remaining fits into one last page => stop
      if (rest.length <= nextPageLines + lastPageLines) break;
      chunks.push(rest.slice(0, nextPageLines));
      rest = rest.slice(nextPageLines);
    }

    // now we have: first + (middle chunks...) + last
    chunks.unshift(first);
    chunks.push(rest);
  }

  const totalPages = chunks.length;

  // ==== Render pages ====
  const pagesText: string[] = [];
  chunks.forEach((chunk, idx) => {
    const pageNum = idx + 1;
    const isFirst = pageNum === 1;
    const isLast = pageNum === totalPages;

    const lines: string[] = [];
    lines.push(...makeHeader(pageNum, totalPages, isFirst));
    lines.push(...chunk);

    // fill lines to keep footer at bottom if last page? (optional)
    if (isLast) {
      lines.push(...makeFooterLast());
    } else {
      lines.push("");
      lines.push(center("Dokumen dibuat otomatis.", cols));
    }

    // hard cap linesPerPage with padding (optional)
    // (Dot matrix kadang butuh konsisten)
    while (lines.length < linesPerPage) lines.push("");

    pagesText.push(lines.join("\n"));
  });

  // Form feed between pages for dot matrix that supports it
  return pagesText.join("\n\f\n");
}

/** =========================
 *  HELPERS
 *  ========================= */

function safe(v: any) {
  return String(v ?? "").trim();
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtQty(q: number) {
  // dot matrix: jangan kebanyakan decimal. kalau kamu perlu decimal, ubah di sini.
  if (Number.isInteger(q)) return String(q);
  return String(q);
}

function rp(n: number) {
  const x = Math.round(num(n));
  return "Rp " + x.toLocaleString("id-ID");
}

function fmtDate(s: any) {
  if (!s) return "-";
  const d = new Date(String(s));
  if (Number.isNaN(d.getTime())) return String(s);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

function fmtLong(s: any) {
  if (!s) return "";
  const d = new Date(String(s));
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function calc(inv: any, items: any[]) {
  const sub = (items || []).reduce((a, it) => a + num(it?.qty) * num(it?.price), 0);

  let disc = 0;
  if (inv?.discount_type === "percent") disc = sub * (num(inv?.discount_value) / 100);
  if (inv?.discount_type === "fixed" || inv?.discount_type === "amount") disc = num(inv?.discount_value);

  const afterDisc = Math.max(0, sub - disc);

  let tax = 0;
  if (inv?.tax_type === "percent") tax = afterDisc * (num(inv?.tax_value) / 100);
  if (inv?.tax_type === "fixed" || inv?.tax_type === "amount") tax = num(inv?.tax_value);

  const total = Math.max(0, afterDisc + tax);
  return { sub, disc, tax, total };
}

function hr(cols: number) {
  return repeat("=", cols);
}

function repeat(ch: string, n: number) {
  return new Array(Math.max(0, n)).fill(ch).join("");
}

function sp(n: number) {
  return repeat(" ", n);
}

function padRight(s: string, w: number) {
  const str = String(s ?? "");
  if (str.length >= w) return str.slice(0, w);
  return str + sp(w - str.length);
}

function padLeft(s: string, w: number) {
  const str = String(s ?? "");
  if (str.length >= w) return str.slice(0, w);
  return sp(w - str.length) + str;
}

function center(s: string, w: number) {
  const str = String(s ?? "");
  if (str.length >= w) return str.slice(0, w);
  const left = Math.floor((w - str.length) / 2);
  return sp(left) + str;
}

function twoCol(left: string, right: string, cols: number) {
  const r = String(right ?? "");
  const l = String(left ?? "");
  const space = Math.max(1, cols - r.length);
  return padRight(l, space) + r;
}

function wrap(text: string, width: number) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return [""];
  const out: string[] = [];
  let cur = "";
  for (const word of t.split(" ")) {
    if (!cur) {
      cur = word;
    } else if ((cur + " " + word).length <= width) {
      cur = cur + " " + word;
    } else {
      out.push(cur.slice(0, width));
      cur = word;
    }
  }
  if (cur) out.push(cur.slice(0, width));
  return out;
}

function totalRow(label: string, value: number, cols: number, strong?: boolean) {
  const txt = `${label}: ${rp(value)}`;
  // right align totals block
  const blockW = 34;
  const indent = Math.max(0, cols - blockW);
  return sp(indent) + (strong ? txt.toUpperCase() : txt);
}