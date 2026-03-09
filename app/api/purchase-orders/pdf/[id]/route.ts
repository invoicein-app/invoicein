// ✅ FULL REPLACE (IMPLEMENT TOGGLE SHOW SHIP-TO NAME)
// invoiceku/app/api/purchase-orders/pdf/[id]/route.ts
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

// ✅ NEW: opsi PDF PO
type PoPdfOpt = {
  show_ship_to_name: boolean; // hanya nama gudang (phone/address tetap tampil)
};

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

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
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: userRes } = await supabaseUser.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: poGate, error: poGateErr } = await supabaseUser
    .from("purchase_orders")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (poGateErr) return NextResponse.json({ error: poGateErr.message }, { status: 403 });
  if (!poGate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 2) Admin client
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: po, error: poErr } = await admin
    .from("purchase_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (poErr || !po) return NextResponse.json({ error: poErr?.message || "PO not found" }, { status: 400 });

  const { data: items, error: itemsErr } = await admin
    .from("purchase_order_items")
    .select("name, qty, price, sort_order")
    .eq("purchase_order_id", id)
    .order("sort_order", { ascending: true });

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 });

  let org: OrgProfile | null = null;
  if (po.org_id) {
    const { data: orgData } = await admin
      .from("organizations")
      .select("id,name,address,phone,email,logo_url")
      .eq("id", po.org_id)
      .maybeSingle();

    org = (orgData as any) || null;
  }

  // ✅ NEW: ambil toggle PDF PO dari settings per org
  // NOTE: ganti nama tabel & kolom sesuai yang kamu sudah bikin di settings
  let poOpt: PoPdfOpt = { show_ship_to_name: true };

  if (po.org_id) {
    const { data: setRow } = await admin
      // TODO: ganti ini sesuai tabel settings kamu:
      .from("po_settings")
      // TODO: ganti field sesuai yang kamu bikin:
      .select("show_warehouse_name")
      .eq("organization_id", po.org_id)
      .maybeSingle();

    if (setRow) {
      poOpt = {
        show_ship_to_name: (setRow as any).show_warehouse_name ?? true,
      };
    }
  }

  const logoSrc = String(org?.logo_url || "").trim();

  const element = React.createElement(PurchaseOrderPDF as any, {
    po,
    items: items || [],
    org,
    logoSrc,
    poOpt, // ✅ pass ke PDF
  }) as any;

  const buffer = await pdf(element).toBuffer();

  const fileBase = String(po.po_number || "purchase-order").trim() || "purchase-order";
  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${fileBase}.pdf"`,
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

function paginate3<T>(items: T[], firstCount: number, nextCount: number, lastCount: number) {
  const list = items || [];
  const n = list.length;

  const f = Math.max(1, Number(firstCount || 1));
  const m = Math.max(1, Number(nextCount || 1));
  const l = Math.max(1, Number(lastCount || 1));

  if (n === 0) return { pages: [[] as T[]] };
  if (n <= f) return { pages: [list] };

  const pages: T[][] = [];
  pages.push(list.slice(0, f));
  const rest = list.slice(f);

  if (rest.length <= l) {
    pages.push(rest);
    return { pages };
  }

  const middlePart = rest.slice(0, rest.length - l);
  const lastPart = rest.slice(rest.length - l);

  let idx = 0;
  while (idx < middlePart.length) {
    pages.push(middlePart.slice(idx, idx + m));
    idx += m;
  }

  pages.push(lastPart);
  return { pages };
}

function PurchaseOrderPDF(props: {
  po: any;
  items: any[];
  org: OrgProfile | null;
  logoSrc: string;
  poOpt: { show_ship_to_name: boolean };
}) {
  const { po, items, org, logoSrc, poOpt } = props;

  const ITEMS_FIRST_PAGE = 10;
  const ITEMS_NEXT_PAGES = 18;
  const ITEMS_LAST_PAGE = 12;

  const { pages: itemPages } = paginate3(items || [], ITEMS_FIRST_PAGE, ITEMS_NEXT_PAGES, ITEMS_LAST_PAGE);
  const totalPages = itemPages.length;

  const orgName = org?.name || "INVOICEKU";
  const orgAddress = org?.address || "";
  const orgPhone = org?.phone || "";
  const orgEmail = org?.email || "";

  const poNo = String(po.po_number || "-");
  const poDate = fmtDateIndo(po.po_date || po.created_at);

  const vendorName = String(po.vendor_name || "-");
  const vendorPhone = String(po.vendor_phone || "");
  const vendorAddr = String(po.vendor_address || "");

  // ✅ snapshot ship-to dari PO
  const shipToName = String(po.ship_to_name || "");
  const shipToPhone = String(po.ship_to_phone || "");
  const shipToAddr = String(po.ship_to_address || "");

  const note = String(po.note || "");

  const subtotal = Number(po.subtotal || 0);
  const taxPercent = Number(po.tax_percent || 0);
  const taxAmount = Number(po.tax_amount || 0);
  const total = Number(po.total || 0);

  const showShipToName = poOpt?.show_ship_to_name ?? true;

  return React.createElement(
    Document,
    null,
    ...itemPages.map((pageItems, pageIndex) => {
      const isFirst = pageIndex === 0;
      const isLast = pageIndex === totalPages - 1;

      return React.createElement(
        Page,
        { key: pageIndex, size: "A4", style: styles.page },

        React.createElement(View, { style: styles.topBar }),

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
                ? React.createElement(Text, { style: styles.muted }, `${orgPhone}${orgPhone && orgEmail ? " • " : ""}${orgEmail}`)
                : null
            )
          ),

          React.createElement(
            View,
            { style: { alignItems: "flex-end" } },
            React.createElement(Text, { style: styles.invLabel }, "PURCHASE ORDER"),
            React.createElement(Text, { style: styles.invNo }, poNo),
            React.createElement(Text, { style: styles.muted }, `Tanggal: ${poDate}`),
            React.createElement(Text, { style: styles.muted }, `Halaman ${pageIndex + 1}/${totalPages}`)
          )
        ),

        isFirst
          ? React.createElement(
              View,
              { style: styles.twoCols },

              // Dipesan ke
              React.createElement(
                View,
                { style: styles.card },
                React.createElement(Text, { style: styles.cardTitleBlue }, "Dipesan ke"),
                React.createElement(Text, { style: styles.bold }, vendorName),
                vendorPhone ? React.createElement(Text, { style: styles.muted }, vendorPhone) : null,
                vendorAddr ? React.createElement(Text, { style: styles.muted }, vendorAddr) : null
              ),

              // Ship To (✅ nama gudang conditional)
              React.createElement(
                View,
                { style: styles.card },
                React.createElement(Text, { style: styles.cardTitleBlue }, "Ship To"),
                showShipToName && shipToName ? React.createElement(Text, { style: styles.bold }, shipToName) : null,
                shipToPhone ? React.createElement(Text, { style: styles.muted }, shipToPhone) : null,
                shipToAddr ? React.createElement(Text, { style: styles.muted }, shipToAddr) : null
              )
            )
          : null,

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
                  React.createElement(Text, { style: styles.muted }, note ? note : "-")
                ),
                React.createElement(
                  View,
                  { style: [styles.card, styles.totalCard] },
                  RowPDF("Subtotal", rupiah(subtotal)),
                  RowPDF(`Pajak (${Math.max(0, Math.floor(taxPercent))}%)`, rupiah(taxAmount)),
                  React.createElement(View, { style: styles.divider }),
                  RowPDF("Grand Total", rupiah(total), true, true)
                )
              ),
              React.createElement(
                View,
                { style: styles.signatureWrap },
                React.createElement(Text, { style: styles.signatureDate }, fmtLongDate(po.po_date || po.created_at)),
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
    React.createElement(Text, { style: strong ? (blueStrong ? styles.rowValStrongBlue : styles.rowValStrong) : styles.rowVal }, v)
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

  signatureWrap: { marginTop: 36, alignSelf: "flex-end", width: 260, paddingRight: 24, paddingBottom: 10 },
  signatureDate: { fontSize: 10, color: "#111", marginBottom: 6, textAlign: "right" },
  signatureRespect: { fontSize: 10, color: "#111", marginBottom: 26, textAlign: "right" },
  signatureSpace: { height: 44, borderBottomWidth: 1, borderBottomColor: "#111", width: 170, marginLeft: "auto", marginBottom: 6 },

  muted: { color: "#666" },
  bold: { fontWeight: 800 },
});
