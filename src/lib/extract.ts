import { UPLOAD_LIMITS, type ExtractedDoc } from "./analysis-schema";

export class ExtractError extends Error {}

const ext = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();

/** Returns an error message if the file is not allowed, else null. */
export function checkFile(file: File): string | null {
  if (!UPLOAD_LIMITS.acceptedExtensions.includes(ext(file.name)))
    return `${file.name}: use PDF, TXT, MD, DOCX, EML, JPG, PNG or WebP.`;
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
  const error = checkFile(file);
  if (error) throw new ExtractError(error);
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext(file.name)))
    throw new ExtractError("Photographs need your consent for AI image reading.");
  if (ext(file.name) === ".docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    if (result.value.length > UPLOAD_LIMITS.maxTotalChars) throw new ExtractError("This Word document exceeds the text limit.");
    const chunks = chunkText(result.value);
    if (!chunks.length) throw new ExtractError("No readable text found in this Word document.");
    return { filename: file.name, chunks };
  }
  if (ext(file.name) === ".eml") {
    const { default: PostalMime } = await import("postal-mime");
    const mail = await new PostalMime().parse(await file.arrayBuffer());
    const text = [`From: ${mail.from?.name || ""} ${mail.from?.address || ""}`, `To: ${mail.to?.map(p => p.address).join(", ") || ""}`, `Date: ${mail.date || ""}`, `Subject: ${mail.subject || ""}`, mail.text || ""].join("\n");
    if (text.length > UPLOAD_LIMITS.maxTotalChars) throw new ExtractError("This email exceeds the text limit.");
    return { filename: file.name, chunks: chunkText(text) };
  }
  if (ext(file.name) !== ".pdf") {
    const text = await file.text();
    if (text.length > UPLOAD_LIMITS.maxTotalChars) throw new ExtractError(`${file.name}: text exceeds 120,000 characters.`);
    return { filename: file.name, chunks: chunkText(text) };
  }

  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
   const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: 0 });
   let pdf;
  try {
     pdf = await task.promise;
  } catch {
     await task.destroy();
    throw new ExtractError(`${file.name}: this PDF couldn't be opened. It may be damaged or password-protected.`);
  }
  try {
    const chunks: ExtractedDoc["chunks"] = [];
    let total = 0;
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const text = content.items.map((it) => ("str" in it ? it.str : "")).join(" ").replace(/\s+/g, " ").trim();
      total += text.length;
      if (total > UPLOAD_LIMITS.maxTotalChars || p > 500) throw new ExtractError(`${file.name}: this PDF contains too much text or too many pages.`);
      if (text) chunks.push({ location: `page ${p}`, text });
      page.cleanup();
    }
    if (!chunks.length) throw new ExtractError(`${file.name}: no readable text found. Scanned images aren't supported yet.`);
    return { filename: file.name, chunks };
   } finally { await task.destroy(); }
}
