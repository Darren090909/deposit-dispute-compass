import { UPLOAD_LIMITS, type ExtractedDoc } from "./analysis-schema";

export class ExtractError extends Error {}

const ext = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();

/** Returns an error message if the file is not allowed, else null. */
export function checkFile(file: File): string | null {
  if (!UPLOAD_LIMITS.acceptedExtensions.includes(ext(file.name)))
    return `${file.name}: only PDF, .txt and .md files are supported.`;
  if (file.size > UPLOAD_LIMITS.maxFileBytes) return `${file.name}: files must be 5 MB or smaller.`;
  if (file.size === 0) return `${file.name}: this file is empty.`;
  return null;
}

/** Split plain text into ~40-line chunks labelled with line ranges. */
export function chunkText(text: string, linesPer = 40): ExtractedDoc["chunks"] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const chunks: ExtractedDoc["chunks"] = [];
  for (let i = 0; i < lines.length; i += linesPer) {
    const part = lines.slice(i, i + linesPer).join("\n").trim();
    if (part) chunks.push({ location: `lines ${i + 1}–${Math.min(i + linesPer, lines.length)}`, text: part });
  }
  return chunks;
}

/** Extracts text in the browser. Files themselves are never uploaded. */
export async function extractFile(file: File): Promise<ExtractedDoc> {
  if (ext(file.name) !== ".pdf") return { filename: file.name, chunks: chunkText(await file.text()) };

  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch {
    throw new ExtractError(`${file.name}: this PDF couldn't be opened. It may be damaged or password-protected.`);
  }
  const chunks: ExtractedDoc["chunks"] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map((it) => ("str" in it ? it.str : "")).join(" ").replace(/\s+/g, " ").trim();
    if (text) chunks.push({ location: `page ${p}`, text });
  }
  if (!chunks.length) throw new ExtractError(`${file.name}: no readable text found. Scanned images aren't supported yet.`);
  return { filename: file.name, chunks };
}
