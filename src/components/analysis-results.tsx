import { useState } from "react";
import { Check, Copy, Download, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FACT_KIND_LABELS, type AnalysisOutput } from "@/lib/analysis-schema";
import { analysisText, canUseOutput } from "@/lib/analysis-utils";
import { getSource, sourceControlledNotes, sourceReviewDate } from "@/lib/legal-sources";
import { SourceSafeguards } from "@/components/source-safeguards";

export function AnalysisResults({ value, onChange, onUseLetter }: {
  value: AnalysisOutput; onChange: (v: AnalysisOutput) => void; onUseLetter: () => void;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [notice, setNotice] = useState("");
  const change = (patch: Partial<AnalysisOutput>) => { setReviewed(false); setNotice(""); onChange({ ...value, ...patch }); };
  const field = (label: string, text: string, save: (text: string) => void, rows = 2) => (
    <label className="block space-y-1 text-sm"><span className="text-muted-foreground">{label}</span>
      <Textarea aria-label={label} value={text} rows={rows} onChange={e => save(e.target.value)} className="text-base" />
    </label>
  );
  return <div className="space-y-8">
    <SourceSafeguards />
    <div className="border-l-4 border-accent bg-teal-soft p-4 text-sm">
      <strong>AI-assisted analysis — not a legal decision.</strong> Check every statement against your documents. An allegation is not proof; an interpretation may be wrong.
    </div>
    <section><h2 className="mb-3 text-2xl font-semibold">Neutral summary</h2>
      {field("Case summary", value.summary, summary => change({ summary }), 4)}</section>
    <section><h2 className="mb-3 text-2xl font-semibold">Chronological events</h2>
      {!value.events.length && <p className="text-muted-foreground">No events identified.</p>}
      <div className="space-y-4">{value.events.map((e, i) => <div key={i} className="border-b border-border pb-4">
        <p className="mb-2 text-sm font-semibold text-accent">{FACT_KIND_LABELS[e.kind]} · {e.sourceRef ?? "No source / AI interpretation"}</p>
        <label className="mb-2 block text-sm">Date (leave blank if unknown)<Input aria-label={`Event date ${i + 1}`} type="date" value={e.date ?? ""} onChange={x => change({ events: value.events.map((v,j) => j === i ? { ...v, date: x.target.value || null } : v) })} className="mt-1 max-w-52" /></label>
        {field(`Event ${i + 1}`, e.description, description => change({ events: value.events.map((v,j) => j === i ? { ...v, description } : v) }))}
      </div>)}</div></section>
    <section><h2 className="mb-3 text-2xl font-semibold">Evidence items</h2>
      {!value.evidence.length && <p className="text-muted-foreground">No evidence identified.</p>}
      <div className="space-y-4">{value.evidence.map((e,i) => <div key={i} className="border-b border-border pb-4">
        <p className="mb-2 break-words text-sm font-semibold text-accent">{FACT_KIND_LABELS[e.kind]} · {e.sourceRef ?? "No source / AI interpretation"}</p>
        <p className="mb-2 text-sm text-muted-foreground">AI assessment: {e.supports === "unclear" ? "support unclear" : e.supports === "neutral" ? "neutral" : `supports ${e.supports}`}</p>
        {field(`Evidence ${i + 1}`, e.statement, statement => change({ evidence: value.evidence.map((v,j) => j === i ? { ...v, statement } : v) }))}
      </div>)}</div></section>
    <section><h2 className="mb-3 text-2xl font-semibold">Conflicting information</h2>
      {!value.conflicts.length && <p className="text-muted-foreground">No conflicts identified — this does not confirm all statements are accurate.</p>}
      <div className="space-y-3">{value.conflicts.map((c,i) => <div key={i}>
        <p className="text-sm text-muted-foreground">{c.sourceRefs ?? "Sources unclear"}</p>
        {field(`Conflict ${i + 1}`, c.description, description => change({ conflicts: value.conflicts.map((v,j) => j === i ? { ...v, description } : v) }))}
      </div>)}</div></section>
    <section><h2 className="mb-3 text-2xl font-semibold">Missing information</h2>
      {!value.missingInformation.length && <p className="text-muted-foreground">No missing information identified.</p>}
      <div className="space-y-3">{value.missingInformation.map((m,i) => field(`Missing item ${i + 1}`, m, text => change({ missingInformation: value.missingInformation.map((v,j) => j === i ? text : v) })))}</div></section>
    <section><h2 className="mb-3 text-2xl font-semibold">Unresolved questions</h2>
      {!value.unresolvedQuestions.length && <p className="text-muted-foreground">No follow-up questions identified.</p>}
      <div className="space-y-4">{value.unresolvedQuestions.map((q,i) => <div key={i} className="space-y-2">
        {field(`Question ${i + 1}`, q.question, question => change({ unresolvedQuestions: value.unresolvedQuestions.map((v,j) => j === i ? { ...v, question } : v) }))}
        {field(`Why it matters ${i + 1}`, q.why, why => change({ unresolvedQuestions: value.unresolvedQuestions.map((v,j) => j === i ? { ...v, why } : v) }))}
      </div>)}</div></section>
    <section><h2 className="mb-3 text-2xl font-semibold">General procedure</h2>
      {!sourceControlledNotes(value.procedureNotes).length && <p className="text-sm text-muted-foreground">No reviewed procedural explanation available. Consult the guidance source register above.</p>}
      <div className="space-y-4">{sourceControlledNotes(value.procedureNotes).map((p,i) => { const s = getSource(p.sourceId); return <div key={i}>
        <p className="text-sm">{p.explanation}</p>
        <p className="mt-1 text-xs text-muted-foreground">Maintained guidance · page checked {sourceReviewDate(p.sourceId)} · not AI-generated</p>
        {s && <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-accent underline">{s.title}</a>}
      </div>; })}</div></section>
    <section><h2 className="mb-3 text-2xl font-semibold">Draft response</h2>
      {field("AI draft email", value.draftResponse, draftResponse => change({ draftResponse }), 16)}</section>
    <div className="space-y-4 border-t border-border pt-5">
      <label className="flex items-start gap-3 text-sm"><Checkbox checked={reviewed} onCheckedChange={v => setReviewed(v === true)} />I have reviewed all results, checked their sources and corrected inaccuracies.</label>
      <div className="flex flex-wrap gap-3">
        <Button disabled={!canUseOutput(reviewed)} onClick={async () => { if (!canUseOutput(reviewed)) return; try { await navigator.clipboard.writeText(analysisText(value)); setNotice("Analysis copied."); } catch { setNotice("Copy failed. Download the reviewed analysis instead."); } }}><Copy className="h-4 w-4" />Copy analysis</Button>
        <Button variant="outline" disabled={!canUseOutput(reviewed)} onClick={() => { if (!canUseOutput(reviewed)) return; const url = URL.createObjectURL(new Blob([analysisText(value)], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "rentresolve-analysis.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice("Analysis downloaded."); }}><Download className="h-4 w-4" />Download</Button>
        <Button variant="outline" disabled={!canUseOutput(reviewed) || !value.draftResponse.trim()} onClick={() => { if (canUseOutput(reviewed)) onUseLetter(); }}><Mail className="h-4 w-4" />Use draft email</Button>
      </div>
      {notice && <p role="status" className="flex items-center gap-2 text-sm"><Check className="h-4 w-4" />{notice}</p>}
    </div>
  </div>;
}