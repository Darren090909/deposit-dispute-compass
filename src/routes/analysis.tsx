import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader, WithCase } from "@/components/case-ui";
import { AnalysisResults } from "@/components/analysis-results";
import { useCase } from "@/lib/case-store";
import type { Case } from "@/lib/case";
import { buildLetter } from "@/lib/case";
import { analyseCase } from "@/lib/analyze.functions";
import { analysisInputSchema, UPLOAD_LIMITS, type ExtractedDoc } from "@/lib/analysis-schema";
import { checkFile, extractFile } from "@/lib/extract";

export const Route = createFileRoute("/analysis")({
  head: () => ({ meta: [
    { title: "AI case analysis — RentResolve" },
    { name: "description", content: "Review sourced, editable AI analysis of your tenancy deposit documents and answers." },
    { property: "og:title", content: "AI case analysis — RentResolve" },
    { property: "og:description", content: "Upload readable documents and review a neutral, source-grounded deposit dispute analysis." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AnalysisPage,
});

function AnalysisPage() {
  return <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
    <PageHeader eyebrow="AI analysis" title="A closer look at your case" intro="A neutral reading of your answers and documents, with sources, gaps and questions to check." />
    <WithCase>{c => <AnalysisWorkspace key={`${c.tenantName}-${c.address}-${c.isSample}`} c={c} />}</WithCase>
  </div>;
}

function AnalysisWorkspace({ c }: { c: Case }) {
  const { update, setCase } = useCase();
  const navigate = useNavigate();
  const analyse = useServerFn(analyseCase);
  const picker = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; request.current?.abort(); };
  }, []);
  const [documents, setDocuments] = useState<ExtractedDoc[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"reading" | "analysing" | null>(null);
  const [error, setError] = useState("");
  const total = documents.reduce((n,d) => n + d.chunks.reduce((m,t) => m + t.text.length, 0), 0);
  async function addFiles(files: File[]) {
    setError(""); setConsent(false);
    if (files.length + documents.length > UPLOAD_LIMITS.maxFiles) { setError("Choose at most 5 files in total."); return; }
    const errors = files.map(checkFile).filter(Boolean);
    if (errors.length) { setError(errors.join(" ")); return; }
    setBusy("reading");
    try {
      const next = [...documents];
      for (const file of files) {
        if (next.some(d => d.filename === file.name)) throw new Error("Each document needs a unique filename.");
        next.push(await extractFile(file));
      }
      const count = next.reduce((n,d) => n + d.chunks.reduce((m,t) => m + t.text.length, 0), 0);
      if (count > UPLOAD_LIMITS.maxTotalChars) throw new Error("Documents exceed 120,000 characters. Choose fewer or shorter files.");
      if (next.some(d => !d.chunks.length)) throw new Error("A selected file contains no readable text.");
      if (active.current) setDocuments(next);
    } catch (err) { if (active.current) setError(err instanceof Error ? err.message : "Couldn't read this file."); }
    finally { if (active.current) setBusy(null); }
  }
  async function run() {
    if (!consent || busy) return;
    if (c.analysis && !confirm("Replace your current analysis and its edits?")) return;
    const parsed = analysisInputSchema.safeParse({ consent, answers: c, documents });
    if (!parsed.success) { setError(parsed.error.issues.map(i => i.message).join(" ")); return; }
    setError(""); setBusy("analysing");
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await analyse({ data: parsed.data, signal: controller.signal });
      if (!active.current) return;
      if (result.ok) update({ analysis: result.analysis });
      else setError(result.message);
    } catch { if (active.current) setError("The request couldn't finish. It may already have been processed; no results were saved. Try again only when ready."); }
    finally { request.current = null; if (active.current) { setBusy(null); setDocuments([]); setConsent(false); } }
  }
  return <div className="space-y-8">
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-semibold">Your documents</h2><Button variant="ghost" size="sm" onClick={() => { if (confirm("Close this case and delete its saved details, analysis and draft from this browser?")) { setCase(null); navigate({ to: "/" }); } }} disabled={!!busy}><Trash2 className="h-4 w-4" />Close case</Button></div>
      <p className="text-sm text-muted-foreground">PDF, .txt or .md · up to 5 files · 5 MB per file · 120,000 extracted characters total. Scanned or password-protected PDFs are not supported.</p>
      <input ref={picker} type="file" multiple accept={UPLOAD_LIMITS.acceptAttr} className="hidden" aria-label="Upload documents" onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void addFiles(files); }} />
      <div className="border border-dashed border-border bg-muted/30 p-6 text-center">
        <Upload className="mx-auto mb-3 h-7 w-7 text-accent" />
        <Button variant="outline" disabled={!!busy || documents.length >= 5} onClick={() => picker.current?.click()}><Upload className="h-4 w-4" />Choose documents</Button>
      </div>
      {documents.map(d => <div key={d.filename} className="flex items-start gap-3 border-b border-border pb-3"><FileText className="mt-1 h-5 w-5 shrink-0 text-accent" /><div className="min-w-0 flex-1"><p className="break-words font-semibold">{d.filename}</p><p className="text-sm text-muted-foreground">{d.chunks.length} referenced sections · {d.chunks.reduce((n,c) => n+c.text.length,0).toLocaleString()} characters</p><details className="mt-2 text-sm"><summary className="cursor-pointer text-accent">Preview extracted text</summary>{d.chunks.map((t,i) => <div key={i} className="mt-2"><strong>{t.location}</strong><p className="whitespace-pre-wrap break-words">{t.text}</p></div>)}</details></div><Button variant="ghost" size="icon" aria-label={`Remove ${d.filename}`} disabled={!!busy} onClick={() => { setDocuments(documents.filter(x => x !== d)); setConsent(false); }}><Trash2 className="h-4 w-4" /></Button></div>)}
      <p className="text-sm text-muted-foreground">{documents.length} / 5 files · {total.toLocaleString()} / 120,000 characters. <Link to="/intake" className="text-accent underline">Update your answers</Link></p>
      <details className="text-sm"><summary className="cursor-pointer text-accent">Answers sent with the documents</summary><dl className="mt-3 space-y-2">{Object.entries(analysisInputSchema.innerType().shape.answers.parse(c)).map(([key,v]) => <div key={key}><dt className="font-semibold">{key.replace(/([A-Z])/g," $1")}</dt><dd className="break-words">{String(v) || "Not supplied"}</dd></div>)}</dl></details>
      <div className="space-y-3 border-l-4 border-accent bg-teal-soft p-4 text-sm">
        <p>Only extracted text, filenames, page/line references and your answers are sent to the configured AI provider (Google Gemini). The original files are not uploaded. Remove sensitive details you do not want to share.</p>
        <p>Files and text remain in this page’s memory until analysis finishes or you leave. RentResolve does not save them on its server. Results and edits are saved only in this browser until you delete the analysis or close the case.</p>
        <p>AI usage draws on the app’s API allowance. When AI is unavailable, a clearly labelled sample analysis is shown instead.</p>
        <label className="flex items-start gap-3"><Checkbox checked={consent} disabled={!!busy} onCheckedChange={v => setConsent(v === true)} />I agree to send this text and my answers to the AI provider.</label>
      </div>
      <Button disabled={!consent || !!busy} onClick={() => void run()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy === "reading" ? "Reading documents…" : busy === "analysing" ? "Analysing case…" : c.analysis ? "Run new analysis" : "Analyse my case"}</Button>
      {busy === "analysing" && <p role="status" className="text-sm text-muted-foreground">Reviewing sources and uncertainties. This may take a minute.</p>}
      {error && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
    </section>
    {c.analysis && !busy && <><div className="flex items-center justify-between gap-3 border-t border-border pt-6"><h2 className="text-2xl font-semibold">Saved analysis</h2><Button variant="ghost" onClick={() => { if (confirm("Delete saved AI analysis and any AI draft email?")) update({ analysis: undefined, ...(c.letterOrigin === "ai" ? { letter: buildLetter(c), letterOrigin: "template" as const } : {}) }); }}><Trash2 className="h-4 w-4" />Delete analysis</Button></div>
      <AnalysisResults value={c.analysis} onChange={analysis => update({ analysis })} onUseLetter={() => { if (!c.analysis || !confirm("Replace your current draft email with this reviewed AI draft?")) return; update({ letter: c.analysis.draftResponse, letterOrigin: "ai" }); navigate({ to: "/letter" }); }} />
    </>}
  </div>;
}