export function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function num(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}