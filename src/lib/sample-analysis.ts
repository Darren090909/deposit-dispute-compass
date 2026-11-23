import type { AnalysisOutput } from "./analysis-schema";

/** Reference to the fictional sample evidence bundled with the project. */
export const fictionalInventoryChunks = "fictional-inventory.txt, lines 1–3";

/** Clearly-labelled demonstration output, used only when the AI is unavailable. */
export const SAMPLE_ANALYSIS: AnalysisOutput = {
  summary: "SAMPLE ONLY — This demonstration analysis is not based on your documents or answers. It uses a fictional case in which a student disputes a £1,200 carpet replacement deduction from an £1,800 deposit, with the landlord alleging pet damage and the tenant reporting the carpet was already worn at the start of the tenancy.",
  events: [
    { date: "2025-09-01", description: "SAMPLE: Tenancy began, with an inventory noting the living-room carpet as used.", kind: "documented", sourceRef: fictionalInventoryChunks },
    { date: "2026-06-30", description: "SAMPLE: Check-out record lists a carpet replacement deduction of £1,200.", kind: "documented", sourceRef: fictionalInventoryChunks },
    { date: null, description: "SAMPLE: The landlord attributed the deduction to pet damage; the tenant disputes this.", kind: "allegation", sourceRef: null },
    { date: null, description: "SAMPLE: The carpet's condition before the tenancy suggests wear may predate the damage claim.", kind: "ai_interpretation", sourceRef: null },
  ],
  evidence: [
    { statement: "SAMPLE: Inventory describes the carpet as 'used, minor wear to thoroughfare'.", kind: "documented", sourceRef: fictionalInventoryChunks, supports: "tenant" },
    { statement: "SAMPLE: The tenant reports the carpet was worn when they moved in.", kind: "user_reported", sourceRef: "Your answers", supports: "tenant" },
    { statement: "SAMPLE: The landlord states pet damage required full replacement.", kind: "allegation", sourceRef: null, supports: "landlord" },
    { statement: "SAMPLE: No invoice or proof of the £1,200 replacement cost is included.", kind: "ai_interpretation", sourceRef: null, supports: "unclear" },
  ],
  conflicts: [
    { description: "SAMPLE: The tenant reports pre-existing wear; the landlord alleges pet damage. Both cannot be independently confirmed from the supplied material.", sourceRefs: `${fictionalInventoryChunks}; Your answers` },
  ],
  missingInformation: [
    "SAMPLE: A receipt or invoice for the replacement carpet.",
    "SAMPLE: Check-in/check-out photographs of the carpet.",
    "SAMPLE: Any mid-tenancy inspections or correspondence about the carpet.",
  ],
  unresolvedQuestions: [
    { question: "SAMPLE: Do you have photographs of the carpet from when you moved in?", why: "They would help distinguish pre-existing wear from later damage." },
    { question: "SAMPLE: Was a pet kept at the property, and is this recorded anywhere?", why: "The landlord's stated reason has not been independently shown." },
  ],
  procedureNotes: [],
  draftResponse: "SAMPLE ONLY — Dear [Landlord or agent],\n\nI am writing about the £1,200 deduction from my £1,800 deposit for carpet replacement. I do not agree with this deduction. The check-in inventory describes the carpet as used with minor wear, and I reported its condition when I moved in.\n\nPlease could you share the invoice or receipt for the replacement, and any photographs showing the carpet's condition at the start and end of the tenancy?\n\nI hope we can resolve this directly. I am happy to discuss it further.\n\nKind regards,\n[Your name]",
};
