import type { SupabaseClient } from "@supabase/supabase-js";

export const ID_MONTHS = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
] as const;

export type CustomerItemSummaryRow = {
  customer_id: string;
  customer_name: string;
  product_id: string | null;
  item_key: string | null;
  product_name: string;
  latest_price: number;
  total_qty: number;
  transaction_count: number;
  last_updated: string | null;
  lifetime_latest_price: number | null;
  lifetime_updated_at: string | null;
};

type InvoiceLine = {
  invoice_id: string;
  customer_id: string;
  customer_name: string;
  invoice_date: string | null;
  invoice_created_at: string | null;
  product_id: string | null;
  item_key: string | null;
  item_name: string;
  qty: number;
  price: number;
};

type GroupAcc = {
  customer_id: string;
  customer_name: string;
  product_id: string | null;
  item_key: string | null;
  product_name: string;
  total_qty: number;
  invoice_ids: Set<string>;
  lines: Array<{
    invoice_id: string;
    invoice_date: string | null;
    invoice_created_at: string | null;
    price: number;
  }>;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function floorQty(v: unknown): number {
  return Math.max(0, num(v));
}

function floorPrice(v: unknown): number {
  return Math.max(0, Math.floor(num(v)));
}

function groupKey(customerId: string, productId: string | null, itemKey: string | null): string | null {
  const cid = String(customerId || "").trim();
  if (!cid) return null;
  const pid = String(productId || "").trim();
  if (pid) return `${cid}::p:${pid}`;
  const key = String(itemKey || "").trim().toLowerCase();
  if (key) return `${cid}::m:${key}`;
  return null;
}

export function parsePeriodMonthYear(monthRaw: unknown, yearRaw: unknown, now = new Date()) {
  const month = Math.max(1, Math.min(12, Math.floor(num(monthRaw) || now.getMonth() + 1)));
  const year = Math.floor(num(yearRaw) || now.getFullYear());
  return { month, year };
}

export function periodBounds(year: number, month: number) {
  const y = Math.floor(year);
  const m = Math.max(1, Math.min(12, Math.floor(month)));
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const label =
    ID_MONTHS.find((x) => x.value === m)?.label || String(m);
  return { start, end, label: `${label} ${y}`, month: m, year: y };
}

function compareInvoiceRecency(a: InvoiceLine["invoice_date"], b: InvoiceLine["invoice_date"], aCreated: string | null, bCreated: string | null) {
  const ad = String(a || "");
  const bd = String(b || "");
  if (ad !== bd) return bd.localeCompare(ad);
  return String(bCreated || "").localeCompare(String(aCreated || ""));
}

function pickLatestLine(lines: GroupAcc["lines"]) {
  if (!lines.length) return null;

  const byInvoice = new Map<string, GroupAcc["lines"]>();
  for (const line of lines) {
    const list = byInvoice.get(line.invoice_id) || [];
    list.push(line);
    byInvoice.set(line.invoice_id, list);
  }

  const invoiceKeys = [...byInvoice.keys()].sort((a, b) => {
    const la = byInvoice.get(a)![0];
    const lb = byInvoice.get(b)![0];
    return compareInvoiceRecency(
      la.invoice_date,
      lb.invoice_date,
      la.invoice_created_at,
      lb.invoice_created_at
    );
  });

  const latestInvLines = byInvoice.get(invoiceKeys[0]!) || [];
  return latestInvLines[latestInvLines.length - 1] || null;
}

export async function buildCustomerItemPeriodSummary(args: {
  supabase: SupabaseClient;
  orgId: string;
  month: number;
  year: number;
  qCustomer?: string;
  qProduct?: string;
}): Promise<{ period: ReturnType<typeof periodBounds>; rows: CustomerItemSummaryRow[] }> {
  const period = periodBounds(args.year, args.month);
  const qCustomer = String(args.qCustomer || "").trim().toLowerCase();
  const qProduct = String(args.qProduct || "").trim().toLowerCase();

  const { data: invoices, error: invErr } = await args.supabase
    .from("invoices")
    .select(
      `
      id,
      customer_id,
      customer_name,
      invoice_date,
      created_at,
      invoice_items (
        id,
        product_id,
        item_key,
        name,
        qty,
        price
      )
    `
    )
    .eq("org_id", args.orgId)
    .neq("status", "cancelled")
    .not("customer_id", "is", null)
    .gte("invoice_date", period.start)
    .lte("invoice_date", period.end);

  if (invErr) {
    throw new Error(invErr.message);
  }

  const groups = new Map<string, GroupAcc>();

  for (const inv of invoices || []) {
    const invoiceId = String((inv as any).id || "");
    const customerId = String((inv as any).customer_id || "").trim();
    if (!customerId) continue;

    const customerName = String((inv as any).customer_name || "").trim() || "Customer";
    const invoiceDate = (inv as any).invoice_date ? String((inv as any).invoice_date) : null;
    const invoiceCreatedAt = (inv as any).created_at ? String((inv as any).created_at) : null;
    const itemRows = ((inv as any).invoice_items || []) as any[];

    for (const it of itemRows) {
      const productId = String(it?.product_id || "").trim() || null;
      const itemKey = String(it?.item_key || "").trim().toLowerCase() || null;
      const key = groupKey(customerId, productId, itemKey);
      if (!key) continue;

      const qty = floorQty(it?.qty);
      const price = floorPrice(it?.price);
      const itemName = String(it?.name || "").trim() || itemKey || productId || "-";

      const prev = groups.get(key) || {
        customer_id: customerId,
        customer_name: customerName,
        product_id: productId,
        item_key: itemKey,
        product_name: itemName,
        total_qty: 0,
        invoice_ids: new Set<string>(),
        lines: [],
      };

      prev.total_qty += qty;
      prev.invoice_ids.add(invoiceId);
      prev.lines.push({
        invoice_id: invoiceId,
        invoice_date: invoiceDate,
        invoice_created_at: invoiceCreatedAt,
        price,
      });
      if (itemName && itemName !== "-") prev.product_name = itemName;
      groups.set(key, prev);
    }
  }

  let rows: CustomerItemSummaryRow[] = Array.from(groups.values()).map((g) => {
    const latest = pickLatestLine(g.lines);
    return {
      customer_id: g.customer_id,
      customer_name: g.customer_name,
      product_id: g.product_id,
      item_key: g.item_key,
      product_name: g.product_name,
      latest_price: latest ? floorPrice(latest.price) : 0,
      total_qty: g.total_qty,
      transaction_count: g.invoice_ids.size,
      last_updated: latest?.invoice_date || null,
      lifetime_latest_price: null,
      lifetime_updated_at: null,
    };
  });

  if (rows.length > 0) {
    const customerIds = [...new Set(rows.map((r) => r.customer_id))];
    const { data: lifetimeRows } = await args.supabase
      .from("customer_item_latest_prices")
      .select("customer_id, product_id, item_key, matching_key, latest_price, updated_at")
      .eq("org_id", args.orgId)
      .in("customer_id", customerIds);

    const lifetimeMap = new Map<string, { price: number; updated_at: string | null }>();
    for (const row of lifetimeRows || []) {
      const cid = String((row as any).customer_id || "");
      const pid = String((row as any).product_id || "").trim() || null;
      const ikey = String((row as any).item_key || "").trim().toLowerCase() || null;
      const lk = groupKey(cid, pid, ikey);
      if (!lk) continue;
      lifetimeMap.set(lk, {
        price: floorPrice((row as any).latest_price),
        updated_at: (row as any).updated_at ? String((row as any).updated_at) : null,
      });
    }

    rows = rows.map((r) => {
      const lk = groupKey(r.customer_id, r.product_id, r.item_key);
      const life = lk ? lifetimeMap.get(lk) : undefined;
      return {
        ...r,
        lifetime_latest_price: life?.price ?? null,
        lifetime_updated_at: life?.updated_at ?? null,
      };
    });
  }

  if (qCustomer) {
    rows = rows.filter((r) => r.customer_name.toLowerCase().includes(qCustomer));
  }
  if (qProduct) {
    rows = rows.filter((r) => {
      const hay = `${r.product_name} ${r.item_key || ""}`.toLowerCase();
      return hay.includes(qProduct);
    });
  }

  rows.sort((a, b) => {
    const cn = a.customer_name.localeCompare(b.customer_name, "id");
    if (cn !== 0) return cn;
    return a.product_name.localeCompare(b.product_name, "id");
  });

  return { period, rows };
}

export function yearOptions(now = new Date(), span = 6): number[] {
  const current = now.getFullYear();
  const years: number[] = [];
  for (let y = current; y >= current - span + 1; y -= 1) years.push(y);
  return years;
}
