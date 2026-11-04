import { z } from "zod";
import { LEGAL_SOURCE_IDS } from "./legal-sources";

/** Upload limits — shared by the browser (pre-check) and the server (re-check). */
export const UPLOAD_LIMITS = {
  maxFiles: 5,
  maxFileBytes: 5 * 1024 * 1024,
  maxTotalChars: 120_000,
  acceptedExtensions: [".pdf", ".txt", ".md"],
  acceptAttr: ".pdf,.txt,.md,application/pdf,text/plain,text/markdown",
};

export const FACT_KINDS = ["documented", "user_reported", "allegation", "ai_interpretation"] as const;
export type FactKind = (typeof FACT_KINDS)[number];
export const FACT_KIND_LABELS: Record<FactKind, string> = {
  documented: "Documented fact",
  user_reported: "You said",
  allegation: "Allegation",
  ai_interpretation: "AI interpretation",
};

export const chunkSchema = z.object({
  /** e.g. "page 2" or "lines 1–40" */
  location: z.string().max(80),
  text: z.string().max(UPLOAD_LIMITS.maxTotalChars),
});
export const extractedDocSchema = z.object({
  filename: z.string().max(200),
  chunks: z.array(chunkSchema).max(500),
});
export type ExtractedDoc = z.infer<typeof extractedDocSchema>;

export const analysisInputSchema = z.object({
  consent: z.literal(true),
  answers: z.object({
    tenantName: z.string().max(200),
    landlordName: z.string().max(200),
    address: z.string().max(300),
    tenancyStart: z.string().max(20),
    tenancyEnd: z.string().max(20),
    depositAmount: z.number().finite().positive(),
    disputedAmount: z.number().finite().positive(),
    scheme: z.string().max(40),
    deductionReason: z.string().max(2000),
    tenantView: z.string().max(5000),
  }),
  documents: z.array(extractedDocSchema).max(UPLOAD_LIMITS.maxFiles),
}).superRefine((input, ctx) => {
  if (input.answers.disputedAmount > input.answers.depositAmount)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The disputed amount can't be more than the deposit." });
  const total = input.documents.reduce((n, d) => n + d.chunks.reduce((m, c) => m + c.text.length, 0), 0);
  if (total > UPLOAD_LIMITS.maxTotalChars)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Documents exceed the 120,000-character text limit." });
});
export type AnalysisInput = z.infer<typeof analysisInputSchema>;

/** Strict-compatible output schema: every field required, nullable instead of optional. */
export const analysisOutputSchema = z.object({
  summary: z.string(),
  events: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      description: z.string(),
      kind: z.enum(FACT_KINDS),
      sourceRef: z.string().nullable(),
    }),
  ),
  evidence: z.array(
    z.object({
      statement: z.string(),
      kind: z.enum(FACT_KINDS),
      sourceRef: z.string().nullable(),
      supports: z.enum(["tenant", "landlord", "neutral", "unclear"]),
    }),
  ),
  conflicts: z.array(z.object({ description: z.string(), sourceRefs: z.string().nullable() })),
  missingInformation: z.array(z.string()),
  unresolvedQuestions: z.array(z.object({ question: z.string(), why: z.string() })),
  procedureNotes: z.array(z.object({ explanation: z.string(), sourceId: z.enum(LEGAL_SOURCE_IDS) })),
  draftResponse: z.string(),
});
export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;

export type AnalysisResult = { ok: true; analysis: AnalysisOutput } | { ok: false; status: number; message: string };
