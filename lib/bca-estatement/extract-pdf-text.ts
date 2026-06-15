import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

let workerConfigured = false;

async function ensurePdfWorker(): Promise<void> {
  if (workerConfigured) return;

  const { PDFParse } = await import("pdf-parse");
  const workerPath = path.join(
    process.cwd(),
    "node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs"
  );

  if (!fs.existsSync(workerPath)) {
    throw new Error(
      "Modul PDF worker tidak ditemukan. Jalankan npm install dan coba lagi."
    );
  }

  PDFParse.setWorker(pathToFileURL(workerPath).href);
  workerConfigured = true;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  await ensurePdfWorker();
  const { PDFParse } = await import("pdf-parse");

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return String(result.text || "");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal membaca PDF";
    if (/password/i.test(msg)) {
      throw new Error("PDF dilindungi password. Unggah e-Statement tanpa password.");
    }
    if (/fake worker|workerSrc|worker/i.test(msg)) {
      throw new Error("Gagal memuat modul pembaca PDF. Coba restart server dev lalu unggah ulang.");
    }
    throw new Error(msg);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
