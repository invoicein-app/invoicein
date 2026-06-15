export function parseIndonesianAmount(raw: string): number | null {
  const normalized = String(raw || "").replace(/,/g, "").trim();
  if (!normalized) return null;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatAmountForMatch(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Extract the last monetary amount from a line (BCA uses comma thousands + dot decimals). */
export function extractTrailingAmount(text: string): { amount: number; rest: string } | null {
  const trimmed = text.trim();
  const commaAmount = trimmed.match(/(\d{1,3}(?:,\d{3})+\.\d{2})\s*$/);
  if (commaAmount) {
    const amount = parseIndonesianAmount(commaAmount[1]);
    if (amount == null) return null;
    return {
      amount,
      rest: trimmed.slice(0, trimmed.length - commaAmount[0].length).trim(),
    };
  }

  const plainAmount = trimmed.match(/(\d+\.\d{2})\s*$/);
  if (plainAmount) {
    const amount = parseIndonesianAmount(plainAmount[1]);
    if (amount == null) return null;
    return {
      amount,
      rest: trimmed.slice(0, trimmed.length - plainAmount[0].length).trim(),
    };
  }

  return null;
}
