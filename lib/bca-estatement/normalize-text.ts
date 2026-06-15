import { NOISE_LINE_PATTERNS } from "./constants";

export function normalizePdfText(raw: string): string {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function splitStatementLines(text: string): string[] {
  return normalizePdfText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isNoiseLine(line: string): boolean {
  if (!line.trim()) return true;
  return NOISE_LINE_PATTERNS.some((re) => re.test(line.trim()));
}

export function isSummaryFooterLine(line: string): boolean {
  return /SALDO AWAL\s*:/i.test(line) && /MUTASI CR\s*:/i.test(line) && /SALDO AKHIR\s*:/i.test(line);
}

export function isTransactionStartLine(line: string): boolean {
  return /^\d{2}\/\d{2}\s+\S/.test(line.trim());
}

export function cleanStatementLines(lines: string[]): string[] {
  const cleaned: string[] = [];

  for (const line of lines) {
    if (isNoiseLine(line)) continue;
    if (isSummaryFooterLine(line)) continue;
    cleaned.push(line);
  }

  return cleaned;
}

export function groupTransactionBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (isTransactionStartLine(line)) {
      if (current.length) blocks.push(current.join("\n"));
      current = [line];
      continue;
    }

    if (!current.length) continue;
    current.push(line);
  }

  if (current.length) blocks.push(current.join("\n"));
  return blocks;
}
