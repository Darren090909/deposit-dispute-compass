import type { AnalysisOutput } from "./analysis-schema";
import type { Case } from "./case";

/** Only explicitly reviewed non-interpretive material is promoted into case records. */
export function applyReviewedAnalysis(c: Case, analysis: AnalysisOutput): Partial<Case> {
  const events = analysis.events.filter(e => e.kind !== "ai_interpretation" && e.kind !== "allegation" && e.date);
  const timeline = [...c.timeline];
  for (const e of events) {
    if (!e.date || timeline.some(t => t.date === e.date && t.label === e.description && t.source === e.sourceRef)) continue;
    timeline.push({ id: crypto.randomUUID(), date: e.date, label: e.description, source: e.sourceRef ?? "Your answers", origin: "analysis" });
  }
  const facts = [...c.facts];
  for (const e of analysis.evidence.filter(e => e.kind === "documented" || e.kind === "user_reported")) {
    if (!facts.some(f => f.text === e.statement && f.source === e.sourceRef)) facts.push({ text: e.statement, source: e.sourceRef ?? "Your answers" });
  }
  return { analysis, summary: analysis.summary, timeline: timeline.sort((a,b) => a.date.localeCompare(b.date)), facts, missing: analysis.missingInformation };
}