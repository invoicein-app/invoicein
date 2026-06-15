import { CanvasFactory, getData } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

let workerConfigured = false;

async function ensurePdfWorker(): Promise<void> {
  if (workerConfigured) return;
  PDFParse.setWorker(getData());
  workerConfigured = true;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  await ensurePdfWorker();

  const parser = new PDFParse({ data: buffer, CanvasFactory });
  try {
    const result = await parser.getText();
    return String(result.text || "");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal membaca PDF";
    if (/password/i.test(msg)) {
      throw new Error("PDF dilindungi password. Unggah e-Statement tanpa password.");
    }
    if (/fake worker|workerSrc|worker/i.test(msg)) {
      throw new Error("Gagal memuat modul pembaca PDF. Coba unggah ulang.");
    }
    if (/DOMMatrix|canvas/i.test(msg)) {
      throw new Error("Server belum siap membaca PDF. Hubungi admin jika error berlanjut.");
    }
    throw new Error(msg);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
