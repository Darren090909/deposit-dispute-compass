import type { AnalysisOutput, ExtractedDoc } from "./analysis-schema";
import { FACT_KIND_LABELS } from "./analysis-schema";
import { getSource } from "./legal-sources";

export function validateAnalysisSources(output: AnalysisOutput, documents: ExtractedDoc[]): boolean {
  const refs = new Set(documents.flatMap(d => d.chunks.map(c => `${d.filename}, ${c.location}`)));
  return [...output.events, ...output.evidence].every(item => {
    if (item.kind === "documented") return item.sourceRef !== null && refs.has(item.sourceRef);
    if (item.kind === "user_reported") return item.sourceRef === "Your answers";
    return item.sourceRef === null || item.sourceRef === "Your answers" || refs.has(item.sourceRef);
  });
}

export const canUseOutput = (reviewed: boolean, busy = false) => reviewed && !busy;

export function analysisText(a: AnalysisOutput): string {
  return ["RentResolve — AI-assisted analysis (reviewed by user)",
    "General information only, not a determination of legal rights or professional advice.",
    "\nSUMMARY", a.summary, "\nEVENTS",
    ...a.events.map(e => `${e.date ?? "Date unknown"}: ${e.description} [${FACT_KIND_LABELS[e.kind]}; ${e.sourceRef ?? "No source / interpretation"}]`),
    "\nEVIDENCE", ...a.evidence.map(e => `${e.statement} [${FACT_KIND_LABELS[e.kind]}; ${e.sourceRef ?? "No source / interpretation"}; supports: ${e.supports}]`),
    "\nCONFLICTS", ...a.conflicts.map(c => `${c.description} (${c.sourceRefs ?? "Sources unclear"})`),
    "\nMISSING INFORMATION", ...a.missingInformation,
    "\nUNRESOLVED QUESTIONS", ...a.unresolvedQuestions.map(q => `${q.question}\n${q.why}`),
    "\nGENERAL PROCEDURE", ...a.procedureNotes.map(p => { const s = getSource(p.sourceId); return `${p.explanation}\n${s?.title}: ${s?.url}`; }),
    "\nDRAFT EMAIL", a.draftResponse].join("\n");
}