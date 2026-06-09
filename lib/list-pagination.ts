export function parseIntSafe(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function parseListPageParams(
  sp: { p?: string; ps?: string },
  defaults: { page?: number; pageSize?: number; maxPageSize?: number } = {}
) {
  const pageSize = Math.min(
    parseIntSafe(sp.ps, defaults.pageSize ?? 20),
    defaults.maxPageSize ?? 50
  );
  const page = Math.max(parseIntSafe(sp.p, defaults.page ?? 1), 1);
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  const totalPages = (totalRows: number) => Math.max(1, Math.ceil(totalRows / pageSize));

  return { page, pageSize, fromIdx, toIdx, totalPages };
}

export function buildListPageQuery(
  base: Record<string, string | undefined>,
  patch: Record<string, string>
) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v) next.set(k, v);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === "") next.delete(k);
    else next.set(k, v);
  }
  return next.toString();
}
